# How docai-highlight Works

A deep technical explanation of the full pipeline: extraction → AI context → coordinate resolution → highlighting.

---

## The Problem

When you send a PDF to an AI (GPT, Claude, Gemini, etc.), the AI reads **text**. When it responds with insights, findings, or quotes — you want to **highlight those exact passages** on the original PDF.

This is deceptively hard because:
1. **AI paraphrases** — it rarely quotes text verbatim
2. **AI reorders** — bullet points don't follow document order  
3. **AI summarizes** — the response text may be shorter than the source
4. **PDF text extraction is lossy** — word positions get lost when you extract plain text

The naive approach (search for AI text in PDF) fails for all the above reasons.

---

## The Solution: Single-Extraction Dual-Representation

The key insight is to extract **two representations from one pass**:

```
                    ┌──────────────────────────┐
                    │     PDF Document          │
                    └────────────┬─────────────┘
                                 │
                    ┌────────────▼─────────────┐
                    │  Python Extractor         │
                    │  (PyMuPDF4LLM + fitz)     │
                    │                           │
                    │  Single pass extracts:    │
                    │  • Markdown text           │
                    │  • Word bounding boxes     │
                    │  • Character offsets        │
                    └──────┬──────────┬─────────┘
                           │          │
              ┌────────────▼──┐  ┌────▼────────────┐
              │  fullText      │  │  Position Index  │
              │  (for the AI)  │  │  (for resolver)  │
              └────────────────┘  └─────────────────┘
```

### Representation 1: `fullText` (AI Context)

This is what the AI reads. It's markdown with `[PAGE_X]` markers:

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

The `[PAGE_X]` markers serve a dual purpose:
- The AI naturally references page numbers in its response
- You can pass `estimatedPage` to the resolver to speed up matching

### Representation 2: Position Index

This is the highlight engine. For each page, it stores:

```typescript
{
  pageNum: 1,
  width: 595.28,           // Page dimensions (PDF units)
  height: 841.89,
  text: "PROJECT OVERVIEW Client: Acme Corp Ltd...",  // Anchor text
  items: [
    { text: "PROJECT",   x: 72.5, y: 750.2, width: 45.3, height: 12.0, charOffset: 0 },
    { text: "OVERVIEW",  x: 120.1, y: 750.2, width: 58.7, height: 12.0, charOffset: 8 },
    { text: "Client:",   x: 72.5, y: 735.0, width: 42.1, height: 11.0, charOffset: 17 },
    // ... every word on the page
  ]
}
```

**The critical link**: the `anchor text` is the **single source of truth**. Both the `fullText` (sent to AI) and the `items` (bounding boxes) reference the same character offsets in this text.

---

## Phase 1: Extraction (Python)

The Python extractor (`pdf_extractor.py`) uses PyMuPDF4LLM for a single-pass extraction:

```python
# One call gets everything
chunks = pymupdf4llm.to_markdown(
    input_path,
    page_chunks=True,     # Per-page chunks
    extract_words=True,   # Word bounding boxes
    page_separators=False,
)
```

For each page, it then builds the **anchor text** — a deterministic concatenation of all words in reading order:

```python
def build_anchor_data(words, page_height):
    # 1. Sort words by block → line → word → position (deterministic)
    parsed_words.sort(key=lambda w: (block_no, line_no, word_no, y, x))
    
    # 2. Concatenate with intelligent spacing
    for word in parsed_words:
        # Add newlines between lines, spaces between words
        # Respect no-space-before chars: . , : ; ! ?
        # Respect no-space-after chars: ( [ { / ₹ $
        
        spans.append({
            "text": token,
            "x": x0,
            "y": page_height - y1,   # Flip Y for frontend coordinate system
            "char_offset": char_offset,
        })
    
    return anchor_text, spans
```

**Key design decision**: The `fullText` sent to the AI is built from this **anchor text** (not the markdown). This ensures that when the AI copies text verbatim, it matches exactly what the resolver searches against.

---

## Phase 2: AI Context & Structured Output

The `fullText` from the position index is sent to any LLM. To guarantee reliable highlights, we force the LLM to output structured JSON with an `answer` mapping to an array of verbatim `quotes`:

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

The AI naturally produces responses separated from the document text. When it provides the `answer`:

> "The development budget is stated as **$750,000 fixed cost** on page 3"

It will simultaneously provide exact `quotes` it used to formulate that answer: `["$750,000 fixed cost"]`. You feed these verbatim quotes to the resolver.

---

## Phase 3: Highlight Resolution (The Magic)

The resolver uses a **3-tier matching strategy** — no LLM needed:

### Tier 1: Exact Substring Match

```typescript
// Fast path: check if the AI text appears verbatim in the anchor text
const matchIndex = pageText.indexOf(cleanSearch);
if (matchIndex !== -1) {
  return { pageNum, charStart: matchIndex, charEnd: matchIndex + cleanSearch.length };
}
```

This handles ~70% of cases where the AI quotes directly.

### Tier 2: Case-Insensitive Match

```typescript
// Handle capitalization differences
const matchIndex = pageText.toLowerCase().indexOf(lowerSearch);
```

Catches cases like "Total Budget" vs "total budget".

### Tier 3: Word-Level Sliding Window

This is what makes highlighting work even for paraphrased AI responses:

```typescript
// Tokenize both texts into word arrays
const searchWords = tokenize(aiText);    // ["750,000", "fixed", "cost"]

// Slide a window over page words
for (let i = 0; i <= pageWords.length - searchWords.length; i++) {
  const window = pageWords.slice(i, i + windowSize);
  const windowSet = new Set(window.map(w => w.word));
  
  // Count how many search words appear in this window
  let matchCount = 0;
  for (const sw of searchWords) {
    if (windowSet.has(sw)) matchCount++;
  }
  
  const score = matchCount / searchWords.length;
  if (score >= 0.6) {  // 60% of words must match
    return { pageNum, charStart: window[0].start, charEnd: window.last.end };
  }
}
```

This works because even when the AI says "the development phase costs $750,000 as a fixed fee", the key words (`750,000`, `fixed`, `cost`) appear in a tight window in the original text.

### Page-Priority Optimization

When the AI mentions a page number (or you know the estimated page), the resolver searches that page first, then neighbors:

```typescript
const orderedPages = pages.sort((a, b) => {
  const distA = Math.abs(a.pageNum - estimatedPage);
  const distB = Math.abs(b.pageNum - estimatedPage);
  return distA - distB;
});
```

This avoids false matches from similar text on other pages.

---

## Phase 4: Visual Highlighting

Once you have a `ResolvedHighlight` for each of your quotes, convert it to bounding boxes:

```typescript
// Assuming aiQuotes = ["$750,000 fixed cost"]
const highlight = resolveHighlight(index, aiQuotes[0]);
const spans = getSpansForHighlight(index, highlight);

// spans = [
//   { text: "$750,000", x: 150.2, y: 400.1, width: 42.5, height: 11.0 },
//   { text: "fixed",    x: 195.0, y: 400.1, width: 24.3, height: 11.0 },
//   { text: "cost",     x: 221.6, y: 400.1, width: 20.7, height: 11.0 },
// ]
```

In your PDF viewer (react-pdf, pdf.js, etc.), draw rectangles at these coordinates:

```typescript
for (const span of spans) {
  // Note: y is bottom-up in PDF coords, your viewer may need to flip
  const screenY = pageHeight - span.y - span.height;
  drawHighlight(span.x, screenY, span.width, span.height);
}
```

---

## Storage & Compression

Position indices can be large (10-50KB per page). The compression utilities reduce this by ~40%:

```typescript
// Store
const compressed = compressIndex(index);
// Items become tuples: ["text", x, y, w, h, charOffset]
// instead of: { text: "text", x: ..., y: ..., ... }
fs.writeFileSync('index.json', JSON.stringify(compressed));

// Restore
const stored = JSON.parse(fs.readFileSync('index.json', 'utf-8'));
const index = decompressIndex(stored);
```

---

## Why This Architecture?

| Approach | Accuracy | Speed | LLM Calls |
|----------|----------|-------|-----------|
| Search PDF for AI text | Low (paraphrasing breaks it) | Fast | 0 |
| Ask LLM to return page/line numbers | Medium (hallucination risk) | Slow | 2x |
| **docai-highlight (this)** | **High (3-tier fuzzy matching)** | **Fast** | **1x** |

The key advantages:
1. **No extra LLM calls** — resolution is deterministic string matching
2. **Works with any LLM** — no special prompt format required
3. **Handles paraphrasing** — word-level sliding window catches reworded text
4. **Single source of truth** — anchor text = AI context = highlight target
5. **Bounding box accuracy** — word-level coordinates from the PDF engine itself
