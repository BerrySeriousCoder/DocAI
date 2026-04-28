# Ocular

> Extract text + positions from PDFs, feed to any LLM, and resolve AI responses back to exact document coordinates for highlighting.

The core problem: when an AI reads a PDF and generates insights, how do you highlight those insights back in the original document — especially when the AI paraphrases, reorders, or uses bullet points?

**Ocular** solves this with a single-extraction, dual-representation architecture that requires no second LLM call. The reusable TypeScript implementation in this repo lives in the **`@ocular/pdf`** workspace package.

## Repository layout

This repo is a **Turborepo**-style monorepo ([`turbo.json`](./turbo.json), root [`package.json`](./package.json)):

| Path | Role |
|------|------|
| **`packages/pdf`** (`@ocular/pdf`) | PDF extraction (Python + PyMuPDF), position index, highlight resolver, compression, and optional LLM/auth helpers used by API routes. |
| **`apps/web`** | **Ocular** — Next.js demo: upload a PDF, ask questions, and see highlights in the viewer. |

The library is what you import as `@ocular/pdf`. The web app depends on it via `"@ocular/pdf": "workspace:*"`.

## How It Works (TL;DR)

```
PDF ──→ [Python Extractor] ──→ Two outputs from ONE pass:
  │
  ├─→ 1. LLM-ready text (markdown with [PAGE_X] markers)
  │       → Send to LLM instructing it to return Structured JSON: { answer, quotes }
  │
  └─→ 2. Position index (word bounding boxes + char offsets)
          → Used by the resolver to map verbatim quotes → PDF coordinates

AI quotes ──→ [Multi-tier resolver] ──→ { pageNum, charStart, charEnd }
                                          → Get bounding boxes → Draw highlights
```

## Using `@ocular/pdf` in this monorepo

Add the workspace dependency (see [`apps/web/package.json`](./apps/web/package.json)):

```json
"@ocular/pdf": "workspace:*"
```

```typescript
import {
  extractAndIndex,
  resolveHighlight,
  getSpansForHighlight,
} from '@ocular/pdf';

// Step 1: Extract PDF → position index
const index = await extractAndIndex('/path/to/document.pdf');

// Step 2: Structured response from your LLM (enforce { answer, quotes })
const aiResponse = await yourLLM.chat({
  messages: [{ role: "user", content: `Analyze this document:\n\n${index.fullText}` }],
  response_format: {
    type: "json_schema",
    json_schema: {
      name: "document_answer",
      schema: {
        type: "object",
        properties: {
          answer: { type: "string" },
          quotes: { type: "array", items: { type: "string" } }
        },
        required: ["answer", "quotes"]
      }
    }
  }
});

// Step 3: Resolve quotes → PDF coordinates
for (const quote of aiResponse.quotes) {
  const highlight = resolveHighlight(index, quote);

  if (highlight) {
    console.log(`Found "${quote}" on page ${highlight.pageNum}, chars ${highlight.charStart}-${highlight.charEnd}`);

    const spans = getSpansForHighlight(index, highlight);
    spans.forEach((span) => {
      console.log(`Draw rect at (${span.x}, ${span.y}) size ${span.width}x${span.height}`);
    });
  }
}
```

### Python setup (required for extraction)

The Node bridge spawns Python from **`packages/pdf/python/`** (venv + `pdf_extractor.py`). From the repo root:

```bash
cd packages/pdf/python
python3 -m venv venv
source venv/bin/activate   # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

If `@ocular/pdf` is ever published to npm, the same `python/` directory ships under `node_modules/@ocular/pdf/python/`.

Alternatively, install PyMuPDF globally:

```bash
pip install pymupdf pymupdf4llm
```

### Environment variables (Next.js demo)

Secrets and demo flags belong in the **application**, not in the library. For this repo:

- Copy [`apps/web/.env.example`](./apps/web/.env.example) → **`apps/web/.env.local`** and fill in API keys.
- Next.js loads `.env.local` on the server; **`@ocular/pdf` reads `process.env`** (it does not load its own `.env` file).

## API Reference

### Extraction

#### `extractAndIndex(pdfPath, options?): Promise<PdfPositionIndex>`
Extract a PDF from a file path and build the position index in one call.

#### `extractAndIndexBuffer(buffer, options?): Promise<PdfPositionIndex>`
Same as above, but from an in-memory `Buffer`.

#### `extractPdfFromPath(pdfPath, options?): Promise<PyMuPDFResult>`
Low-level: run the Python extractor and get raw output.

#### `extractPdfFromBuffer(buffer, options?): Promise<PyMuPDFResult>`
Low-level: run the Python extractor from a buffer.

#### `buildPositionIndex(result): PdfPositionIndex`
Convert raw Python output into a structured position index.

### Highlight resolution

#### `resolveHighlight(index, searchText, options?): ResolvedHighlight | null`
Maps a text snippet (e.g. a quote from the model) to character offsets on a page using **multi-tier** matching (no second LLM):

1. **Exact substring** on anchor text  
2. **Case-insensitive** substring  
3. **Punctuation / whitespace–agnostic** pass (aligns when spacing or punctuation differs)  
4. **Word-level sliding window** (default: at least **60%** of quote tokens must appear in a window)

Options:

- `estimatedPage?: number` — search pages near this page first (reduces false positives when the same phrase appears twice).
- `minMatchRatio?: number` — threshold for the sliding-window tier (default: `0.6`).

#### `getSpansForHighlight(index, highlight): TextItemPosition[]`
Word-level bounding boxes for a resolved highlight.

#### `findExactTextSpans(index, searchText, pageNum?): TextItemPosition[]`
Exact text search across the index (useful for "find in document" features).

### Storage

#### `compressIndex(index): CompressedPositionIndex`
Compress for storage (~40% smaller). Span objects become compact tuples.

#### `decompressIndex(compressed): PdfPositionIndex`
Restore from compressed format.

### Extractor options

```typescript
interface ExtractorOptions {
  pythonDir?: string;   // Override path to the `python/` directory (default: next to compiled `dist/`)
  pythonBin?: string;   // Override Python binary (default: `python` in that venv)
  logger?: Logger;      // Custom logger
}
```

## Key types

```typescript
interface PdfPositionIndex {
  indexVersion: 'py-v2';
  totalPages: number;
  pages: PagePositionData[];
  fullText: string;        // Send this to the LLM
}

interface ResolvedHighlight {
  pageNum: number;         // 1-based page number
  charStart: number;       // Start offset in page anchor text
  charEnd: number;         // End offset in page anchor text
}

interface TextItemPosition {
  text: string;
  x: number;
  y: number;               // PDF units (bottom-up origin; flip for many web viewers)
  width: number;
  height: number;
  pageNum: number;
  charOffset: number;
}
```

## Architecture

See [HOW_IT_WORKS.md](./HOW_IT_WORKS.md) for the full pipeline.

## Run the demo

From the repository root (Bun + Turbo):

```bash
bun install
bun run dev
```

This starts the web app and the `@ocular/pdf` TypeScript build in watch mode per [`turbo.json`](./turbo.json).

## Requirements

- **Node.js** ≥ 18  
- **Bun** (see root `packageManager`) or compatible package manager  
- **Python** ≥ 3.10 with **pymupdf** and **pymupdf4llm** (see `packages/pdf/python/requirements.txt`)

## License

MIT
