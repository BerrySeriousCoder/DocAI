// =============================================================================
// Ocular — Public API (@ocular/pdf)
// =============================================================================

export type {
    TextItemPosition,
    PagePositionData,
    PdfPositionIndex,
    ResolvedHighlight,
    ResolveOptions,
    CompressedPositionIndex,
    Logger,
} from './types.js';

export { extractPdfFromPath, extractPdfFromBuffer } from './pdf-extractor.js';
export type { ExtractorOptions } from './pdf-extractor.js';

export {
    buildPositionIndex,
    extractAndIndex,
    extractAndIndexBuffer,
} from './pdf-position-index.js';

export {
    resolveHighlight,
    getSpansForHighlight,
    findExactTextSpans,
} from './highlight-resolver.js';

export { compressIndex, decompressIndex } from './compression.js';

export { initBackendConfig, getConfig, getRequiredConfig } from './config.js';

export { validateToken, checkRateLimit, getClientId } from './auth.js';

export { streamLLMResponse, getLLMStructuredResponse } from './llm.js';
export type { ModelProvider, LLMStreamOptions, DocumentAnswer } from './llm.js';
export { DocumentAnswerSchema } from './llm.js';
