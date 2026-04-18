// =============================================================================
// docai-highlight — Highlight Resolver
//
// The core innovation: deterministically maps AI-generated text back to exact
// document coordinates, using a 3-tier matching strategy.
//
// No second LLM call needed — pure string matching against the position index.
// =============================================================================

import type {
    PdfPositionIndex,
    TextItemPosition,
    ResolvedHighlight,
    ResolveOptions,
} from './types.js';

// =============================================================================
// MAIN RESOLVER
// =============================================================================

/**
 * Resolve a text snippet (from an AI response) back to exact coordinates
 * in the PDF position index.
 *
 * Uses a 3-tier matching strategy:
 * 1. **Exact substring match** — fastest, handles verbatim quotes
 * 2. **Case-insensitive match** — handles capitalization differences
 * 3. **Word-level sliding window** — handles paraphrasing, reordering, bullet points
 *
 * @param positionIndex - The position index built during extraction
 * @param searchText - Text snippet from AI response to locate in the document
 * @param options - Optional: estimated page, min match ratio
 * @returns Resolved highlight with pageNum + char offsets, or null if no match
 *
 * @example
 * ```ts
 * // AI says: "The delivery timeline is 6-8 weeks"
 * const highlight = resolveHighlight(index, "6-8 weeks");
 *
 * if (highlight) {
 *   console.log(`Found on page ${highlight.pageNum}`);
 *   console.log(`Characters ${highlight.charStart}-${highlight.charEnd}`);
 *
 *   // Get the bounding boxes for visual highlighting
 *   const spans = getSpansForHighlight(index, highlight);
 * }
 * ```
 */
export function resolveHighlight(
    positionIndex: PdfPositionIndex,
    searchText: string,
    options: ResolveOptions = {}
): ResolvedHighlight | null {
    if (!searchText || searchText.trim().length < 3) return null;

    const { estimatedPage, minMatchRatio = 0.6 } = options;
    const cleanSearch = searchText.replace(/\r\n/g, '\n').trim();

    // Order pages: estimated page first, then neighbors, then all others
    const orderedPages = [...positionIndex.pages].sort((a, b) => {
        if (!estimatedPage) return a.pageNum - b.pageNum;
        const distA = Math.abs(a.pageNum - estimatedPage);
        const distB = Math.abs(b.pageNum - estimatedPage);
        return distA - distB;
    });

    // --- Tier 1: Exact substring match ---
    for (const page of orderedPages) {
        const pageText = page.text || '';
        if (!pageText) continue;

        const matchIndex = pageText.indexOf(cleanSearch);
        if (matchIndex !== -1) {
            return {
                pageNum: page.pageNum,
                charStart: matchIndex,
                charEnd: matchIndex + cleanSearch.length,
            };
        }
    }

    // --- Tier 2: Case-insensitive exact match ---
    const lowerSearch = cleanSearch.toLowerCase();
    for (const page of orderedPages) {
        const pageText = page.text || '';
        if (!pageText) continue;

        const matchIndex = pageText.toLowerCase().indexOf(lowerSearch);
        if (matchIndex !== -1) {
            return {
                pageNum: page.pageNum,
                charStart: matchIndex,
                charEnd: matchIndex + cleanSearch.length,
            };
        }
    }

    // --- Tier 2.5: Whitespace/punctuation agnostic match ---
    const cleanNoSpaces = cleanSearch.replace(/[\s\p{P}]+/gu, "").toLowerCase();
    if (cleanNoSpaces.length >= 3) {
        for (const page of orderedPages) {
            const pageText = page.text || '';
            if (!pageText) continue;

            let strippedText = "";
            const charMap: number[] = [];

            for (let i = 0; i < pageText.length; i++) {
                if (!/[\s\p{P}]/u.test(pageText[i])) {
                    strippedText += pageText[i].toLowerCase();
                    charMap.push(i);
                }
            }

            const strippedIdx = strippedText.indexOf(cleanNoSpaces);
            if (strippedIdx !== -1) {
                return {
                    pageNum: page.pageNum,
                    charStart: charMap[strippedIdx] as number,
                    charEnd: (charMap[strippedIdx + cleanNoSpaces.length - 1] as number) + 1,
                };
            }
        }
    }

    // --- Tier 3: Word-level sliding window match ---
    const searchWords = tokenize(cleanSearch);
    if (searchWords.length === 0) return null;

    let bestMatch: ResolvedHighlight | null = null;
    let bestScore = 0;

    for (const page of orderedPages) {
        const pageText = page.text || '';
        if (!pageText) continue;

        // Build word list with char offsets in the page anchor text
        const pageWordMatches: Array<{ word: string; start: number; end: number }> = [];
        const wordRegex = /\S+/g;
        let wordMatch: RegExpExecArray | null;
        while ((wordMatch = wordRegex.exec(pageText)) !== null) {
            pageWordMatches.push({
                word: wordMatch[0].toLowerCase(),
                start: wordMatch.index,
                end: wordMatch.index + wordMatch[0].length,
            });
        }

        // Sliding window over page words
        const windowSize = Math.min(searchWords.length + 5, pageWordMatches.length);
        for (let i = 0; i <= pageWordMatches.length - searchWords.length; i++) {
            const windowEnd = Math.min(i + windowSize, pageWordMatches.length);
            const windowWords = pageWordMatches.slice(i, windowEnd);
            const windowWordSet = new Set(windowWords.map((w) => w.word));

            // Count how many search words are in this window
            let matchCount = 0;
            for (const sw of searchWords) {
                if (windowWordSet.has(sw)) {
                    matchCount++;
                }
            }

            const score = matchCount / searchWords.length;
            if (score >= minMatchRatio && score > bestScore) {
                bestScore = score;
                const firstWord = pageWordMatches[i]!;
                const lastWord = pageWordMatches[windowEnd - 1]!;
                bestMatch = {
                    pageNum: page.pageNum,
                    charStart: firstWord.start,
                    charEnd: lastWord.end,
                };
            }
        }
    }

    return bestMatch;
}

// =============================================================================
// SPAN LOOKUP (for bounding boxes)
// =============================================================================

/**
 * Get all word-level spans (bounding boxes) that overlap with a highlight.
 *
 * Use this to draw highlight rectangles on the PDF in your UI.
 *
 * @param positionIndex - The position index
 * @param highlight - A resolved highlight (from resolveHighlight)
 * @returns Array of TextItemPosition with x, y, width, height for each word
 *
 * @example
 * ```ts
 * const highlight = resolveHighlight(index, "some AI text");
 * if (highlight) {
 *   const spans = getSpansForHighlight(index, highlight);
 *   for (const span of spans) {
 *     drawRect(span.x, span.y, span.width, span.height); // your rendering
 *   }
 * }
 * ```
 */
export function getSpansForHighlight(
    positionIndex: PdfPositionIndex,
    highlight: ResolvedHighlight
): TextItemPosition[] {
    const page = positionIndex.pages.find((p) => p.pageNum === highlight.pageNum);
    if (!page) return [];

    return page.items.filter((item) => {
        const itemEnd = item.charOffset + item.text.length;
        return item.charOffset < highlight.charEnd && itemEnd > highlight.charStart;
    });
}

/**
 * Find all spans matching an exact text search across the document.
 *
 * @param positionIndex - The position index
 * @param searchText - Exact text to search for
 * @param pageNum - Optional: limit search to a specific page
 * @returns All matching spans with bounding boxes
 */
export function findExactTextSpans(
    positionIndex: PdfPositionIndex,
    searchText: string,
    pageNum?: number
): TextItemPosition[] {
    if (!searchText) return [];

    const pagesToSearch = pageNum
        ? positionIndex.pages.filter((p) => p.pageNum === pageNum)
        : positionIndex.pages;

    const results: TextItemPosition[] = [];

    for (const page of pagesToSearch) {
        const pageText = page.text || '';
        if (!pageText) continue;

        let searchStart = 0;
        while (true) {
            const matchIndex = pageText.indexOf(searchText, searchStart);
            if (matchIndex === -1) break;

            const matchEnd = matchIndex + searchText.length;
            for (const item of page.items) {
                const itemEnd = item.charOffset + item.text.length;
                if (item.charOffset < matchEnd && itemEnd > matchIndex) {
                    results.push(item);
                }
            }

            searchStart = matchIndex + 1;
        }
    }

    return results;
}

// =============================================================================
// INTERNAL HELPERS
// =============================================================================

/**
 * Tokenize text into words, stripping markdown artifacts.
 * Returns lowercase words for matching.
 */
function tokenize(text: string): string[] {
    return text
        .replace(/[|*#_~`>\-\[\](){}]/g, ' ') // strip markdown formatting
        .replace(/\s+/g, ' ')
        .trim()
        .toLowerCase()
        .split(' ')
        .filter((w) => w.length > 0);
}
