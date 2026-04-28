# How Ocular / `@ocular/pdf` Works

A deep technical explanation of the full pipeline: extraction → AI context → coordinate resolution → highlighting.

Implementation lives in **`packages/pdf`** (`@ocular/pdf`). The **Ocular** Next.js demo consumes it from **`apps/web`** (API routes + UI).

---

## The problem

When you send a PDF to an AI (GPT, Claude, Gemini, etc.), the AI reads **text**. When it responds with insights, findings, or quotes — you want to **highlight those exact passages** on the original PDF.

This is deceptively hard because:

1. **AI paraphrases** — it rarely quotes text verbatim  
2. **AI reorders** — bullet points don't follow document order  
3. **AI summarizes** — the response text may be shorter than the source  
4. **PDF text extraction is lossy** — word positions get lost when you extract plain text only  

The naive approach (search for AI text in the PDF) fails for all of the above.

---

## The solution: single-extraction dual representation

The key insight is to extract **two representations from one pass**:

```
                    ┌──────────────────────────┐
                    │     PDF Document         │
                    └────────────┬─────────────┘
                                 │
                    ┌────────────▼─────────────┐
                    │  Python extractor       │
                    │  (PyMuPDF4LLM + fitz)     │
                    │                           │
                    │  Single pass extracts:    │
                    │  • Markdown / page text   │
                    │  • Word bounding boxes     │
                    │  • Character offsets       │
                    └──────┬──────────┬─────────┘
                           │          │
              ┌────────────▼──┐  ┌────▼────────────┐
              │  fullText      │  │  Position index │
              │  (for the AI)  │  │  (for resolver)│
              └────────────────┘  └─────────────────┘
```

### Representation 1: `fullText` (AI context)

What the model sees — typically with `[PAGE_X]` markers:

```
[PAGE_1]
PROJECT OVERVIEW
Client: Acme Corp Ltd
Project Duration: 01/04/2024 to 31/03/2025
Total Budget: $2,500,000

[PAGE_2]
DELIVERABLES AND MILESTONES
1. Phase 1 — Research: 15% of total budget
2. Phase 2 — Development: $750,000 fixed cost
...
```

The `[PAGE_X]` markers help the model cite pages in natural language; your app can parse that signal and pass **`estimatedPage`** into `resolveHighlight` so the resolver tries the right page first.

### Representation 2: Position index

For each page, the index stores anchor **`text`** plus **`items`**: each word’s text, bounding box, and **`charOffset`** into that page’s anchor string.

**The critical link:** anchor text is the **single source of truth**. The `fullText` the LLM reads and the resolver’s `page.text` are built from the same ordering so **verbatim** quotes can be located.

---

## Phase 1: Extraction (Python)

The extractor script is **`packages/pdf/python/pdf_extractor.py`**. It uses PyMuPDF4LLM for a single-pass extraction, then builds per-page anchor text and spans (see the script for the exact `pymupdf4llm.to_markdown` options).

Conceptually, after sorting words in reading order, each token is appended with spacing rules and recorded with `x`, flipped `y`, and `char_offset` — the same spirit as:

```python
def build_anchor_data(words, page_height):
    parsed_words.sort(key=lambda w: (block_no, line_no, word_no, y, x))
    for word in parsed_words:
        spans.append({
            "text": token,
            "x": x0,
            "y": page_height - y1,   # flip Y for web-style coordinates
            "char_offset": char_offset,
        })
    return anchor_text, spans
```

**Design choice:** the LLM-facing `fullText` is aligned with this anchor text so copied substrings still match what `resolveHighlight` searches.

---

## Phase 2: AI context and structured output

The `fullText` from the position index is sent to any LLM. For reliable highlights, enforce structured JSON with **`answer`** and verbatim **`quotes`**:

```typescript
const index = await extractAndIndex('policy.pdf');

const response = await llm.chat({
  messages: [{
    role: "user",
    content: `Analyze this document and find discrepancies:\n\n${index.fullText}`
  }],
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
```

Example: the model’s `answer` might say the budget is **$750,000 fixed cost** on page 3; the `quotes` array should contain **exact** substrings from the document, e.g. `["$750,000 fixed cost"]`, which you pass to `resolveHighlight`.

---

## Phase 3: Highlight resolution (multi-tier, no LLM)

`packages/pdf/src/highlight-resolver.ts` implements **deterministic** matching in order:

### Tier 1: Exact substring

```typescript
const matchIndex = pageText.indexOf(cleanSearch);
if (matchIndex !== -1) {
  return { pageNum, charStart: matchIndex, charEnd: matchIndex + cleanSearch.length };
}
```

### Tier 2: Case-insensitive

```typescript
const matchIndex = pageText.toLowerCase().indexOf(lowerSearch);
```

### Tier 2.5: Punctuation / whitespace–agnostic

Both the quote and the page text are stripped of Unicode punctuation and whitespace; a match maps back to the original character range via a character map. This helps when line breaks or punctuation differ slightly between model output and anchor text.

### Tier 3: Word-level sliding window

The quote is tokenized into words (with light stripping of markdown-ish characters). The resolver slides a window over page words and scores overlap; if **`matchCount / searchWords.length >= minMatchRatio`** (default **0.6**), it accepts the best-scoring window as the highlight range.

### Page-priority optimization

When `estimatedPage` is set, pages are sorted by distance to that page before each tier runs — reducing wrong-page matches when the same clause appears multiple times.

---

## Phase 4: Visual highlighting

Resolve a quote to `{ pageNum, charStart, charEnd }`, then collect spans:

```typescript
const highlight = resolveHighlight(index, aiQuotes[0]);
const spans = getSpansForHighlight(index, highlight);
```

In the viewer (e.g. react-pdf / PDF.js), draw rectangles; remember PDF **y** is often bottom-up relative to the canvas.

---

## Storage and compression

Large indices can be shrunk with **`compressIndex`** / **`decompressIndex`** (~40% smaller) by encoding span objects as tuples.

---

## Where the code lives

| Concern | Path |
|--------|------|
| Python extractor | `packages/pdf/python/pdf_extractor.py`, `requirements.txt` |
| TS ↔ Python bridge, default `python/` path | `packages/pdf/src/pdf-extractor.ts` |
| Index builder | `packages/pdf/src/pdf-position-index.ts` |
| Resolver | `packages/pdf/src/highlight-resolver.ts` |
| Public exports | `packages/pdf/src/index.ts` |
| Demo API | `apps/web/src/app/api/extract`, `ask`, `auth` |
| Demo UI | `apps/web/src/app/page.tsx`, `components/*` |

---

## Why this architecture?

| Approach | Accuracy | Speed | LLM calls |
|----------|----------|-------|-----------|
| Search PDF for AI text | Low (paraphrasing breaks it) | Fast | 0 |
| Ask LLM for page/line numbers | Medium (hallucination risk) | Slow | 2× |
| **Ocular / `@ocular/pdf` (this repo)** | **High (multi-tier matching)** | **Fast** | **1×** for the Q&A |

Advantages:

1. **No extra LLM** for grounding — resolution is string geometry on the index  
2. **Model-agnostic** for the answer — any provider that can return structured JSON  
3. **Paraphrase tolerance** — sliding window when quotes are not perfect  
4. **Single source of truth** — anchor text ties LLM input to resolver input  
5. **Box fidelity** — coordinates come from the PDF engine at word granularity  

---

## Limits (be honest in product copy)

- **Scanned PDFs** need OCR before this text pipeline helps.  
- **Very short quotes** are rejected to avoid spurious matches.  
- **Complex tables / multi-column** layouts can still mis-order text; stronger layout tools or pre-processing may be needed.  
- **Figures and images** are out of scope for text-only quoting.  

For environment and demo setup, see **`apps/web/.env.example`** and run **`bun run dev`** from the repo root.
