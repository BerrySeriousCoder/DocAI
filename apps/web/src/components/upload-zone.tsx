"use client";

import { useCallback, useState } from "react";
import { Upload, FileText, Loader2 } from "lucide-react";
import { useAppStore } from "@/lib/store";

export default function UploadZone() {
    const { setPdfFile, setPdfUrl, setIndexId, setIsExtracting, isExtracting, setTotalPages } = useAppStore();
    const [isDragging, setIsDragging] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const authToken = typeof window !== "undefined" ? localStorage.getItem("ocular_token") : null;

    const handleFile = useCallback(async (file: File) => {
        if (file.type !== "application/pdf") {
            setError("Please upload a PDF file");
            return;
        }
        if (file.size > 50 * 1024 * 1024) {
            setError("File too large (max 50MB)");
            return;
        }

        setError(null);
        setPdfFile(file);
        setPdfUrl(URL.createObjectURL(file));
        setIsExtracting(true);

        try {
            const formData = new FormData();
            formData.append("pdf", file);

            const res = await fetch("/api/extract", {
                method: "POST",
                body: formData,
                headers: authToken ? { "x-auth-token": authToken } : {},
            });

            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data.error || `Extraction failed (${res.status})`);
            }

            const data = await res.json();
            setIndexId(data.indexId);
            setTotalPages(data.totalPages);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Extraction failed");
            setPdfFile(null);
            setPdfUrl(null);
        } finally {
            setIsExtracting(false);
        }
    }, [setPdfFile, setPdfUrl, setIndexId, setIsExtracting, setTotalPages, authToken]);

    return (
        <div className="flex flex-col items-center justify-center h-full w-full p-4 relative">
            <div
                className={`w-full h-full rounded-lg border border-dashed transition-all duration-300 flex flex-col items-center justify-center gap-4 cursor-pointer relative z-10 ${isDragging
                    ? "border-[var(--accent)] bg-[var(--bg-secondary)]/50"
                    : "border-[var(--border-color)] hover:border-[var(--border-active)] hover:bg-[var(--bg-secondary)]/30"
                    }`}
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(e) => {
                    e.preventDefault();
                    setIsDragging(false);
                    const file = e.dataTransfer.files[0];
                    if (file) handleFile(file);
                }}
                onClick={() => {
                    const input = document.createElement("input");
                    input.type = "file";
                    input.accept = ".pdf";
                    input.onchange = (e) => {
                        const file = (e.target as HTMLInputElement).files?.[0];
                        if (file) handleFile(file);
                    };
                    input.click();
                }}
            >
                {isExtracting ? (
                    <>
                        <Loader2 className="w-12 h-12 text-[var(--accent)] animate-spin" />
                        <p className="text-[var(--text-secondary)] text-sm">Extracting PDF content...</p>
                        <p className="text-[var(--text-muted)] text-xs">Building position index for highlighting</p>
                    </>
                ) : (
                    <>
                        <div className="w-14 h-14 rounded border border-[var(--border-color)] bg-[var(--bg-primary)] shadow-sm flex items-center justify-center group-hover:border-[var(--border-active)] transition-colors">
                            {isDragging ? (
                                <FileText className="w-6 h-6 text-[var(--accent)]" />
                            ) : (
                                <Upload className="w-6 h-6 text-[var(--text-secondary)]" />
                            )}
                        </div>
                        <div className="text-center">
                            <p className="text-[var(--text-primary)] font-medium">
                                {isDragging ? "Drop your PDF here" : "Upload a PDF document"}
                            </p>
                            <p className="text-[var(--text-muted)] text-sm mt-1">
                                Drag & drop or click to browse • Max 50MB
                            </p>
                        </div>
                    </>
                )}
            </div>

            {error && (
                <p className="mt-4 text-sm text-[var(--error)] bg-[var(--error)]/10 px-4 py-2 rounded-lg">
                    {error}
                </p>
            )}
        </div>
    );
}
