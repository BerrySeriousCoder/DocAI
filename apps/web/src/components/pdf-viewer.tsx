"use client";

import { useState, useCallback, useRef } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Loader2 } from "lucide-react";
import { useAppStore } from "@/lib/store";

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

export default function PdfViewer() {
    const {
        pdfUrl, totalPages, currentPage, setCurrentPage,
        setTotalPages, scale, setScale, activeHighlights,
        currentHighlightIndex, navigateToHighlight,
    } = useAppStore();
    const [pageLoading, setPageLoading] = useState(true);
    const containerRef = useRef<HTMLDivElement>(null);
    const [pageDimensions, setPageDimensions] = useState<{ width: number; height: number } | null>(null);

    const onDocumentLoadSuccess = useCallback(({ numPages }: { numPages: number }) => {
        setTotalPages(numPages);
        setPageLoading(false);
    }, [setTotalPages]);

    const onPageLoadSuccess = useCallback((page: { width: number; height: number; originalWidth: number; originalHeight: number }) => {
        setPageDimensions({ width: page.originalWidth, height: page.originalHeight });
        setPageLoading(false);
    }, []);

    const pageHighlights = activeHighlights.filter((h) => h.pageNum === currentPage);
    const currentHl = activeHighlights[currentHighlightIndex];

    if (!pdfUrl) {
        return (
            <div className="flex items-center justify-center h-full text-[var(--text-muted)]">
                <p className="text-sm">PDF will appear here after upload</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full">
            {/* Toolbar */}
            <div className="flex items-center justify-between px-4 py-2 border-b border-[var(--border-color)] bg-[var(--bg-secondary)]">
                <div className="flex items-center gap-1">
                    <button
                        onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                        disabled={currentPage <= 1}
                        className="p-1.5 rounded-lg hover:bg-[var(--bg-tertiary)] disabled:opacity-30 transition-colors"
                    >
                        <ChevronLeft className="w-4 h-4" />
                    </button>
                    <span className="text-xs text-[var(--text-secondary)] min-w-[80px] text-center">
                        Page {currentPage} of {totalPages}
                    </span>
                    <button
                        onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                        disabled={currentPage >= totalPages}
                        className="p-1.5 rounded-lg hover:bg-[var(--bg-tertiary)] disabled:opacity-30 transition-colors"
                    >
                        <ChevronRight className="w-4 h-4" />
                    </button>
                </div>
                <div className="flex items-center gap-1">
                    <button
                        onClick={() => setScale(Math.max(0.5, scale - 0.1))}
                        className="p-1.5 rounded-lg hover:bg-[var(--bg-tertiary)] transition-colors"
                    >
                        <ZoomOut className="w-4 h-4" />
                    </button>
                    <span className="text-xs text-[var(--text-secondary)] min-w-[45px] text-center">
                        {Math.round(scale * 100)}%
                    </span>
                    <button
                        onClick={() => setScale(Math.min(3, scale + 0.1))}
                        className="p-1.5 rounded-lg hover:bg-[var(--bg-tertiary)] transition-colors"
                    >
                        <ZoomIn className="w-4 h-4" />
                    </button>
                </div>
                {pageHighlights.length > 0 && (
                    <span className="text-xs text-[var(--warning)] bg-[var(--highlight-bg)] px-2 py-1 rounded-full">
                        {pageHighlights.length} highlight{pageHighlights.length > 1 ? "s" : ""} on this page
                    </span>
                )}
            </div>

            {/* Highlight Navigator — only shown when highlights exist */}
            {activeHighlights.length > 0 && (
                <div className="flex items-center justify-center gap-3 px-4 py-1.5 border-b border-[var(--border-color)] bg-[var(--bg-tertiary)]">
                    <button
                        onClick={() => navigateToHighlight(Math.max(0, currentHighlightIndex - 1))}
                        disabled={currentHighlightIndex <= 0}
                        className="p-1 rounded hover:bg-[var(--bg-secondary)] disabled:opacity-30 transition-colors"
                    >
                        <ChevronLeft className="w-3.5 h-3.5" />
                    </button>
                    <span className="text-xs text-[var(--text-secondary)]">
                        Highlight{" "}
                        <span className="font-semibold text-[var(--text-primary)]">{currentHighlightIndex + 1}</span>
                        {" "}of{" "}
                        <span className="font-semibold text-[var(--text-primary)]">{activeHighlights.length}</span>
                        {currentHl && (
                            <span className="text-[var(--text-muted)]"> (Page {currentHl.pageNum})</span>
                        )}
                    </span>
                    <button
                        onClick={() => navigateToHighlight(Math.min(activeHighlights.length - 1, currentHighlightIndex + 1))}
                        disabled={currentHighlightIndex >= activeHighlights.length - 1}
                        className="p-1 rounded hover:bg-[var(--bg-secondary)] disabled:opacity-30 transition-colors"
                    >
                        <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                </div>
            )}

            {/* PDF Content */}
            <div ref={containerRef} className="flex-1 overflow-auto flex justify-center bg-[var(--bg-primary)] p-4">
                <div className="relative">
                    <Document
                        file={pdfUrl}
                        onLoadSuccess={onDocumentLoadSuccess}
                        loading={
                            <div className="flex items-center gap-2 text-[var(--text-muted)]">
                                <Loader2 className="w-5 h-5 animate-spin" />
                                <span className="text-sm">Loading PDF...</span>
                            </div>
                        }
                    >
                        <Page
                            pageNumber={currentPage}
                            scale={scale}
                            renderTextLayer={true}
                            renderAnnotationLayer={true}
                            onLoadSuccess={onPageLoadSuccess}
                            loading={
                                <div className="flex items-center justify-center h-[600px]">
                                    <Loader2 className="w-6 h-6 animate-spin text-[var(--accent)]" />
                                </div>
                            }
                        />

                        {/* Highlight Overlay */}
                        {pageDimensions && pageHighlights.length > 0 && (
                            <svg
                                className="absolute top-0 left-0 pointer-events-none"
                                width={pageDimensions.width * scale}
                                height={pageDimensions.height * scale}
                                style={{ zIndex: 10 }}
                            >
                                {pageHighlights.flatMap((hl) =>
                                    (hl.spans || []).map((span, si) => (
                                        <rect
                                            key={`${hl.charStart}-${si}`}
                                            x={span.x * scale}
                                            y={(pageDimensions.height - span.y - span.height) * scale}
                                            width={span.width * scale}
                                            height={span.height * scale}
                                            rx={2}
                                            className="highlight-rect"
                                            fill="rgba(34, 197, 94, 0.25)"
                                            stroke="rgba(34, 197, 94, 0.6)"
                                            strokeWidth={1}
                                        />
                                    ))
                                )}
                            </svg>
                        )}
                    </Document>
                </div>
            </div>
        </div>
    );
}
