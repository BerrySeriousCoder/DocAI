// =============================================================================
// Ocular — PDF Position Index Builder
//
// Converts raw Python extraction output into a structured PdfPositionIndex.
// =============================================================================

import type {
    PdfPositionIndex,
    PagePositionData,
    TextItemPosition,
    PyMuPDFResult,
    PyMuPDFPageData,
    Logger,
} from './types.js';
import { extractPdfFromPath, extractPdfFromBuffer, type ExtractorOptions } from './pdf-extractor.js';

const defaultLogger: Logger = {
    info: () => { },
    warn: (msg, meta) => console.warn(`[ocular] ${msg}`, meta || ''),
    error: (msg, meta) => console.error(`[ocular] ${msg}`, meta || ''),
};

/**
 * Build a PdfPositionIndex from raw Python extraction result.
 *
 * @param result - Raw output from the Python PDF extractor
 * @returns Structured position index ready for highlight resolution
 */
export function buildPositionIndex(result: PyMuPDFResult): PdfPositionIndex {
    if (!result.success) {
        throw new Error(result.error || 'PDF extraction failed');
    }

    const pageData = result.page_data;
    if (!Array.isArray(pageData) || pageData.length === 0) {
        throw new Error('Extractor returned no page data');
    }

    const pages: PagePositionData[] = pageData
        .map((page: PyMuPDFPageData, idx: number) => {
            const pageNum = Number(page.page_num) || idx + 1;
            const items: TextItemPosition[] = Array.isArray(page.spans)
                ? page.spans.map((span) => ({
                    text: String(span.text || ''),
                    x: Number(span.x) || 0,
                    y: Number(span.y) || 0,
                    width: Number(span.width) || 0,
                    height: Number(span.height) || 0,
                    pageNum,
                    charOffset: Number(span.char_offset) || 0,
                }))
                : [];

            const anchorText =
                typeof page.anchor_text === 'string'
                    ? page.anchor_text
                    : items
                        .sort((a, b) => a.charOffset - b.charOffset)
                        .map((i) => i.text)
                        .join('');

            return {
                pageNum,
                width: Number(page.width) || 0,
                height: Number(page.height) || 0,
                text: anchorText,
                items,
            };
        })
        .sort((a, b) => a.pageNum - b.pageNum);

    const fullText = buildFullText(result.markdown, pages);

    return {
        indexVersion: 'py-v2',
        totalPages: pages.length,
        pages,
        fullText,
    };
}

/**
 * Build the fullText (AI context) from page data.
 * Uses anchor text as the single source of truth.
 */
function buildFullText(pythonFullText: string, pages: PagePositionData[]): string {
    // If Python already built anchor-text-based fullText, use it directly
    if (pythonFullText && pythonFullText.includes('[PAGE_')) {
        return pythonFullText;
    }

    // Fallback: build from pages' anchor text
    const parts: string[] = [];
    for (const page of pages) {
        if (!page.pageNum) continue;
        const anchorText = page.text || '';
        parts.push(`[PAGE_${page.pageNum}]${anchorText ? `\n${anchorText}` : ''}`);
    }

    return parts.join('\n\n');
}

// =============================================================================
// HIGH-LEVEL CONVENIENCE FUNCTIONS
// =============================================================================

/**
 * Extract a PDF from a file path and build the position index in one call.
 *
 * @param pdfPath - Absolute path to the PDF file
 * @param options - Extractor options
 * @returns Position index with fullText for AI + spans for highlighting
 *
 * @example
 * ```ts
 * import { extractAndIndex } from '@ocular/pdf';
 *
 * const index = await extractAndIndex('/path/to/document.pdf');
 *
 * // Send to any LLM
 * const aiResponse = await llm.chat(index.fullText);
 *
 * // Resolve AI response back to document coordinates
 * const highlight = resolveHighlight(index, aiResponse.snippet);
 * ```
 */
export async function extractAndIndex(
    pdfPath: string,
    options: ExtractorOptions = {}
): Promise<PdfPositionIndex> {
    const result = await extractPdfFromPath(pdfPath, options);
    return buildPositionIndex(result);
}

/**
 * Extract a PDF from a buffer and build the position index in one call.
 *
 * @param buffer - PDF file contents as a Buffer
 * @param options - Extractor options
 * @returns Position index with fullText for AI + spans for highlighting
 */
export async function extractAndIndexBuffer(
    buffer: Buffer,
    options: ExtractorOptions = {}
): Promise<PdfPositionIndex> {
    const result = await extractPdfFromBuffer(buffer, options);
    return buildPositionIndex(result);
}
