#!/usr/bin/env python3
"""
docai-highlight — PDF Extractor (PyMuPDF4LLM)

Produces TWO representations from a single extraction pass:
  1. LLM-friendly markdown text with [PAGE_X] markers
  2. Per-page anchor text + word bounding boxes for deterministic highlighting

Usage:
    python pdf_extractor.py <pdf_path>
    python pdf_extractor.py --stdin --stdout   # base64 PDF from stdin, JSON to stdout
"""

import sys
import json
import argparse
import os
import tempfile
import traceback
from typing import Any

try:
    import fitz
    import pymupdf4llm
    from pymupdf4llm.helpers.pymupdf_rag import to_markdown as rag_to_markdown
except ImportError:
    print(json.dumps({
        "error": "Missing dependencies. Install: pip install pymupdf pymupdf4llm pymupdf_layout",
        "success": False,
    }))
    sys.exit(1)


def build_anchor_data(words: list[Any], page_height: float) -> tuple[str, list[dict[str, Any]]]:
    """
    Build deterministic anchor text and span list from extracted words.

    Each span maps to a token in anchor_text with:
    - x, y, width, height in PDF coords (y is bottom-up for frontend transform)
    - char_offset into anchor_text for exact matching
    """
    parsed_words: list[tuple[float, float, float, float, str, int, int, int]] = []

    for raw in words:
        if not isinstance(raw, (list, tuple)) or len(raw) < 8:
            continue

        x0, y0, x1, y1, text, block_no, line_no, word_no = raw[:8]

        token = str(text).strip()
        if not token:
            continue

        try:
            parsed_words.append((
                float(x0),
                float(y0),
                float(x1),
                float(y1),
                token,
                int(block_no),
                int(line_no),
                int(word_no),
            ))
        except (TypeError, ValueError):
            continue

    # Deterministic ordering: block → line → word → position
    parsed_words.sort(key=lambda w: (w[5], w[6], w[7], w[1], w[0]))

    parts: list[str] = []
    spans: list[dict[str, Any]] = []
    char_offset = 0
    prev_line: tuple[int, int] | None = None
    prev_token: str | None = None
    prev_x1: float | None = None

    no_space_before = {".", ",", ":", ";", "!", "?", "%", ")", "]", "}", "/"}
    no_space_after = {"(", "[", "{", "/", "₹", "$", "€", "£"}

    for x0, y0, x1, y1, token, block_no, line_no, _word_no in parsed_words:
        current_line = (block_no, line_no)

        if prev_line is not None:
            separator = ""
            if current_line != prev_line:
                separator = "\n"
            else:
                gap = (x0 - prev_x1) if prev_x1 is not None else 1.0
                if gap > 0.8:
                    if token not in no_space_before and (prev_token or "") not in no_space_after:
                        separator = " "

            if separator:
                parts.append(separator)
                char_offset += len(separator)

        width = max(x1 - x0, 0.0)
        height = max(y1 - y0, 0.0)

        spans.append({
            "text": token,
            "x": x0,
            "y": page_height - y1,  # top-down → bottom-up for frontend
            "width": width,
            "height": height,
            "char_offset": char_offset,
        })

        parts.append(token)
        char_offset += len(token)
        prev_line = current_line
        prev_token = token
        prev_x1 = x1

    return "".join(parts), spans


def extract_with_rag(input_path: str, doc: fitz.Document) -> list[dict[str, Any]]:
    """Primary path: use pymupdf4llm RAG helper for markdown + words."""
    chunks = rag_to_markdown(
        input_path,
        page_chunks=True,
        extract_words=True,
        page_separators=False,
    )

    if isinstance(chunks, str):
        chunks = [{
            "metadata": {"page": 1, "page_count": 1},
            "text": chunks,
            "words": [],
        }]

    page_data: list[dict[str, Any]] = []

    for idx, chunk in enumerate(chunks, start=1):
        metadata = chunk.get("metadata", {}) if isinstance(chunk, dict) else {}
        page_num = int(metadata.get("page", idx))
        page_index = max(0, min(page_num - 1, doc.page_count - 1))

        page = doc.load_page(page_index)
        page_width = float(page.rect.width)
        page_height = float(page.rect.height)

        page_markdown = ""
        page_words: list[Any] = []
        if isinstance(chunk, dict):
            page_markdown = str(chunk.get("text", "") or "").strip()
            page_words = chunk.get("words") or []

        anchor_text, spans = build_anchor_data(page_words, page_height)

        page_data.append({
            "page_num": page_num,
            "markdown": page_markdown,
            "anchor_text": anchor_text,
            "width": page_width,
            "height": page_height,
            "spans": spans,
        })

    return page_data


def extract_with_fitz_direct(doc: fitz.Document) -> list[dict[str, Any]]:
    """
    Robust fallback: extract words directly from fitz page-by-page.
    Still produces full anchor text + span positions for the canonical index.
    """
    page_data: list[dict[str, Any]] = []

    for page_index in range(doc.page_count):
        page = doc.load_page(page_index)
        page_num = page_index + 1
        page_width = float(page.rect.width)
        page_height = float(page.rect.height)

        words = page.get_text("words")
        anchor_text, spans = build_anchor_data(words, page_height)

        # Build simple markdown from the text blocks
        blocks = page.get_text("blocks")
        md_parts: list[str] = []
        for b in sorted(blocks, key=lambda b: (b[1], b[0])):
            if b[6] == 0:  # text block (not image)
                md_parts.append(str(b[4]).strip())
        page_markdown = "\n\n".join(md_parts)

        page_data.append({
            "page_num": page_num,
            "markdown": page_markdown,
            "anchor_text": anchor_text,
            "width": page_width,
            "height": page_height,
            "spans": spans,
        })

    return page_data


def extract_pdf(pdf_path: str | None = None, pdf_bytes: bytes | None = None) -> dict[str, Any]:
    """
    Extract PDF content as:
    - markdown text with [PAGE_X] markers (for AI context)
    - per-page anchor data + spans (for highlighting)
    """
    temp_path: str | None = None

    try:
        if pdf_bytes is not None:
            with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as f:
                f.write(pdf_bytes)
                temp_path = f.name
            input_path = temp_path
        else:
            input_path = pdf_path

        if not input_path:
            return {
                "success": False,
                "markdown": "",
                "pages": 0,
                "page_data": [],
                "error": "No PDF input provided",
            }

        doc = fitz.open(input_path)

        # Try RAG helper first (best markdown quality)
        try:
            page_data = extract_with_rag(input_path, doc)
        except Exception as rag_err:
            # RAG can crash on certain PDFs (e.g. min() on empty header set).
            # Fall back to direct fitz extraction — still produces full
            # anchor text + word positions for the canonical index.
            sys.stderr.write(
                f"[pdf_extractor] RAG failed ({rag_err}), using fitz direct\n"
                f"{traceback.format_exc()}\n"
            )
            page_data = extract_with_fitz_direct(doc)

        anchor_parts: list[str] = []
        for pd in page_data:
            page_num = pd["page_num"]
            anchor_text = pd.get("anchor_text", "")
            anchor_parts.append(
                f"[PAGE_{page_num}]" + (f"\n{anchor_text}" if anchor_text else "")
            )

        full_text = "\n\n".join(anchor_parts)
        doc.close()

        return {
            "success": True,
            "markdown": full_text,
            "pages": len(page_data),
            "page_data": page_data,
            "error": None,
        }

    except Exception as e:
        return {
            "success": False,
            "markdown": "",
            "pages": 0,
            "page_data": [],
            "error": str(e),
        }
    finally:
        if temp_path and os.path.exists(temp_path):
            os.unlink(temp_path)


def main() -> None:
    parser = argparse.ArgumentParser(
        description="docai-highlight: Extract PDF to markdown + anchor index"
    )
    parser.add_argument("pdf_path", nargs="?", help="Path to PDF file")
    parser.add_argument("--stdin", action="store_true", help="Read base64 PDF from stdin")
    parser.add_argument("--stdout", action="store_true", help="Print JSON to stdout")
    parser.add_argument("--output", "-o", help="Output file path")

    args = parser.parse_args()

    if args.stdin:
        import base64
        input_data = sys.stdin.read()
        pdf_bytes = base64.b64decode(input_data)
        result = extract_pdf(pdf_bytes=pdf_bytes)
    elif args.pdf_path:
        result = extract_pdf(pdf_path=args.pdf_path)
    else:
        print(json.dumps({
            "error": "No input. Use --stdin or provide pdf_path",
            "success": False,
        }))
        sys.exit(1)

    output_json = json.dumps(result, ensure_ascii=False)

    if args.output:
        with open(args.output, "w", encoding="utf-8") as f:
            f.write(output_json)
    else:
        print(output_json)


if __name__ == "__main__":
    main()
