// =============================================================================
// Ocular — Position Index Compression
//
// Serialize/deserialize position indices for efficient storage and transport.
// Spans are stored as compact tuples: [text, x, y, width, height, charOffset]
// =============================================================================

import type {
    PdfPositionIndex,
    PagePositionData,
    TextItemPosition,
    CompressedPositionIndex,
} from './types.js';

/**
 * Compress a position index for storage.
 * Reduces JSON size by ~40% by converting span objects to tuples.
 *
 * @example
 * ```ts
 * const index = await extractAndIndex('doc.pdf');
 * const compressed = compressIndex(index);
 * fs.writeFileSync('index.json', JSON.stringify(compressed));
 * ```
 */
export function compressIndex(index: PdfPositionIndex): CompressedPositionIndex {
    return {
        indexVersion: index.indexVersion || 'py-v2',
        totalPages: index.totalPages,
        pages: index.pages.map((page) => ({
            pageNum: page.pageNum,
            width: page.width,
            height: page.height,
            text: page.text,
            items: page.items.map((item) => [
                item.text,
                Math.round(item.x * 100) / 100,
                Math.round(item.y * 100) / 100,
                Math.round(item.width * 100) / 100,
                Math.round(item.height * 100) / 100,
                item.charOffset,
            ] as [string, number, number, number, number, number]),
        })),
    };
}

/**
 * Decompress a stored position index back to the full structure.
 * Handles both compressed (tuple) and uncompressed (object) span formats.
 *
 * @example
 * ```ts
 * const stored = JSON.parse(fs.readFileSync('index.json', 'utf-8'));
 * const index = decompressIndex(stored);
 * const highlight = resolveHighlight(index, "some text");
 * ```
 */
export function decompressIndex(compressed: unknown): PdfPositionIndex {
    const data = compressed as Record<string, unknown>;
    const pages = Array.isArray(data?.pages) ? data.pages : [];

    return {
        indexVersion:
            data?.indexVersion === 'py-v2'
                ? 'py-v2'
                : data?.indexVersion === 'py-v1'
                    ? 'py-v1'
                    : 'legacy-v1',
        totalPages: Number(data?.totalPages) || pages.length,
        fullText: typeof data?.fullText === 'string' ? data.fullText : '',
        pages: pages.map((page: Record<string, unknown>, idx: number) => {
            const pageNum = Number(page?.pageNum) || idx + 1;

            const items: TextItemPosition[] = Array.isArray(page?.items)
                ? (page.items as unknown[]).map((item: unknown) => {
                    // Compressed format: [text, x, y, width, height, charOffset]
                    if (Array.isArray(item)) {
                        return {
                            text: String(item[0] || ''),
                            x: Number(item[1]) || 0,
                            y: Number(item[2]) || 0,
                            width: Number(item[3]) || 0,
                            height: Number(item[4]) || 0,
                            pageNum,
                            charOffset: Number(item[5]) || 0,
                        };
                    }

                    // Uncompressed format: { text, x, y, width, height, charOffset }
                    const obj = item as Record<string, unknown>;
                    return {
                        text: String(obj?.text || ''),
                        x: Number(obj?.x) || 0,
                        y: Number(obj?.y) || 0,
                        width: Number(obj?.width) || 0,
                        height: Number(obj?.height) || 0,
                        pageNum,
                        charOffset: Number(obj?.charOffset) || 0,
                    };
                })
                : [];

            const text =
                typeof page?.text === 'string'
                    ? page.text
                    : items
                        .sort((a, b) => a.charOffset - b.charOffset)
                        .map((item) => item.text)
                        .join('');

            return {
                pageNum,
                width: Number(page?.width) || 0,
                height: Number(page?.height) || 0,
                text,
                items,
            } satisfies PagePositionData;
        }),
    };
}
