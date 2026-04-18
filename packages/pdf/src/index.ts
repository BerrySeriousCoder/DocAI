export type {
    TextItemPosition,
    PagePositionData,
    PdfPositionIndex,
    ResolvedHighlight,
    ResolveOptions,
    CompressedPositionIndex,
    Logger,
} from './types.js';

export { compressIndex, decompressIndex } from './compression.js';

export {
    resolveHighlight,
    getSpansForHighlight,
    findExactTextSpans,
} from './highlight-resolver.js';
