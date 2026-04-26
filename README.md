# docai-highlight

> Extract text + positions from PDFs, feed to any LLM, and resolve AI responses back to exact document coordinates for highlighting.

The core problem: when an AI reads a PDF and generates insights, how do you highlight those insights back in the original document — especially when the AI paraphrases, reorders, or uses bullet points?

**docai-highlight** solves this with a single-extraction, dual-representation architecture that requires no second LLM call.

## How It Works (TL;DR)

```
PDF ──→ [Python Extractor] ──→ Two outputs from ONE pass:
  │
  ├─→ 1. LLM-ready text (markdown with [PAGE_X] markers)
  │       → Send to LLM instructing it to return Structured JSON: { answer, quotes }
  │
  └─→ 2. Position index (word bounding boxes + char offsets)
          → Used by the resolver to map verbatim Quotes → PDF coordinates

AI Quotes ──→ [3-Tier Resolver] ──→ { pageNum, charStart, charEnd }
                                          → Get bounding boxes → Draw highlights
```

## Installation

```bash
npm install docai-highlight
```

### Python Dependencies

The PDF extraction uses PyMuPDF under the hood. Set up a Python venv:

```bash
cd node_modules/docai-highlight/python
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

Or install globally:

```bash
pip install pymupdf pymupdf4llm
```

## Quick Start

```typescript
import {
  extractAndIndex,
  resolveHighlight,
  getSpansForHighlight,
} from 'docai-highlight';

// Step 1: Extract PDF → position index
const index = await extractAndIndex('/path/to/document.pdf');

// Step 2: Extract structured response from LLM (enforce { answer, quotes })
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

// Step 3: Resolve AI quotes back to PDF coordinates
for (const quote of aiResponse.quotes) {
  const highlight = resolveHighlight(index, quote);

  if (highlight) {
    console.log(`Found "${quote}" on Page ${highlight.pageNum}, chars ${highlight.charStart}-${highlight.charEnd}`);
    
    // Step 4: Get bounding boxes for visual highlighting
    const spans = getSpansForHighlight(index, highlight);
    spans.forEach(span => {
      console.log(`Draw rect at (${span.x}, ${span.y}) size ${span.width}x${span.height}`);
    });
  }
}
```

## API Reference

### Extraction

#### `extractAndIndex(pdfPath, options?): Promise<PdfPositionIndex>`
Extract a PDF from a file path and build the position index in one call.

#### `extractAndIndexBuffer(buffer, options?): Promise<PdfPositionIndex>`
Same as above, but from an in-memory Buffer.

#### `extractPdfFromPath(pdfPath, options?): Promise<PyMuPDFResult>`
Low-level: run the Python extractor and get raw output.

#### `extractPdfFromBuffer(buffer, options?): Promise<PyMuPDFResult>`
Low-level: run the Python extractor from a buffer.

#### `buildPositionIndex(result): PdfPositionIndex`
Convert raw Python output into a structured position index.

### Highlight Resolution

#### `resolveHighlight(index, searchText, options?): ResolvedHighlight | null`
The core function. Maps a text snippet (from AI output) to exact PDF coordinates using 3-tier matching:
1. **Exact substring** — handles verbatim quotes
2. **Case-insensitive** — handles capitalization diffs
3. **Word-level sliding window** — handles paraphrasing (60% match threshold)

Options:
- `estimatedPage?: number` — prioritize searching near this page
- `minMatchRatio?: number` — fuzzy match threshold (default: 0.6)

#### `getSpansForHighlight(index, highlight): TextItemPosition[]`
Get word-level bounding boxes for a resolved highlight. Use these to draw rectangles on your PDF viewer.

#### `findExactTextSpans(index, searchText, pageNum?): TextItemPosition[]`
Find all spans matching exact text (useful for search-in-document features).

### Storage

#### `compressIndex(index): CompressedPositionIndex`
Compress for storage (~40% smaller). Converts span objects to tuples.

#### `decompressIndex(compressed): PdfPositionIndex`
Restore from compressed format.

### Configuration

```typescript
interface ExtractorOptions {
  pythonDir?: string;   // Path to Python scripts dir
  pythonBin?: string;   // Path to Python binary
  logger?: Logger;      // Custom logger (default: console)
}
```

## Key Types

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
  text: string;            // Word content
  x: number;               // Left edge (PDF units)
  y: number;               // Bottom edge (PDF units, bottom-up)
  width: number;
  height: number;
  pageNum: number;
  charOffset: number;      // Position in anchor text
}
```

## Architecture

See [HOW_IT_WORKS.md](./HOW_IT_WORKS.md) for the deep technical dive.

## Requirements

- **Node.js** ≥ 18
- **Python** ≥ 3.10
- **pymupdf** ≥ 1.24.0
- **pymupdf4llm** ≥ 0.0.17

## License

MIT
