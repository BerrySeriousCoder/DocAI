// =============================================================================
// Ocular — Types (@ocular/pdf)
// =============================================================================

/**
 * A single word/token extracted from the PDF with its bounding box.
 */
export interface TextItemPosition {
    /** The text content of this span */
    text: string;
    /** Left position in PDF coordinate units */
    x: number;
    /** Bottom position in PDF coordinate units (bottom-up) */
    y: number;
    /** Width of the bounding box */
    width: number;
    /** Height of the bounding box */
    height: number;
    /** 1-based page number */
    pageNum: number;
    /** Character offset within the page's anchor text */
    charOffset: number;
}

/**
 * Position data for a single PDF page.
 */
export interface PagePositionData {
    /** 1-based page number */
    pageNum: number;
    /** Page width in PDF units */
    width: number;
    /** Page height in PDF units */
    height: number;
    /** Canonical anchor text — the single source of truth for text matching */
    text: string;
    /** All word-level spans on this page with bounding boxes */
    items: TextItemPosition[];
}

/**
 * The complete position index for an entire PDF document.
 * This is the core data structure that enables AI-response highlighting.
 */
export interface PdfPositionIndex {
    /** Index format version */
    indexVersion: 'py-v2' | 'py-v1' | 'legacy-v1';
    /** Total number of pages */
    totalPages: number;
    /** Per-page position data */
    pages: PagePositionData[];
    /** Full text sent to the AI (markdown with [PAGE_X] markers) */
    fullText: string;
}

/**
 * A resolved highlight location in the document.
 * Maps AI-generated text back to exact coordinates.
 */
export interface ResolvedHighlight {
    /** 1-based page number where the match was found */
    pageNum: number;
    /** Start character offset in the page's anchor text */
    charStart: number;
    /** End character offset in the page's anchor text */
    charEnd: number;
}

/**
 * Options for the highlight resolver.
 */
export interface ResolveOptions {
    /** Estimated page number (prioritizes searching near this page) */
    estimatedPage?: number;
    /** Minimum word-match ratio for fuzzy matching (0-1, default: 0.6) */
    minMatchRatio?: number;
}

// =============================================================================
// Python Extraction Types (internal, matches pdf_extractor.py output)
// =============================================================================

/** @internal */
export interface PyMuPDFSpan {
    text: string;
    x: number;
    y: number;
    width: number;
    height: number;
    char_offset: number;
}

/** @internal */
export interface PyMuPDFPageData {
    page_num: number;
    markdown: string;
    anchor_text: string;
    width: number;
    height: number;
    spans: PyMuPDFSpan[];
}

/** @internal */
export interface PyMuPDFResult {
    success: boolean;
    markdown: string;
    pages: number;
    page_data?: PyMuPDFPageData[];
    error?: string;
}

// =============================================================================
// Compressed Index (for storage/transport)
// =============================================================================

/**
 * Compressed position index for efficient storage.
 * Items are stored as tuples: [text, x, y, width, height, charOffset]
 */
export interface CompressedPositionIndex {
    indexVersion: string;
    totalPages: number;
    pages: Array<{
        pageNum: number;
        width: number;
        height: number;
        text: string;
        items: Array<[string, number, number, number, number, number]>;
    }>;
}

/**
 * Logger interface — inject your own or use console.
 */
export interface Logger {
    info(message: string, meta?: Record<string, unknown>): void;
    warn(message: string, meta?: Record<string, unknown>): void;
    error(message: string, meta?: Record<string, unknown>): void;
}
