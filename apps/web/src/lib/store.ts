"use client";

import { create } from "zustand";

export interface HighlightSpan {
    pageNum: number;
    x: number;
    y: number;
    width: number;
    height: number;
}

export interface ResolvedHighlight {
    pageNum: number;
    charStart: number;
    charEnd: number;
    spans: HighlightSpan[];
    text: string;
}

export interface ChatMessage {
    id: string;
    role: "user" | "assistant";
    content: string;
    highlights?: ResolvedHighlight[];
    isStreaming?: boolean;
}

interface AppState {
    // Auth
    isAuthenticated: boolean;
    setAuthenticated: (v: boolean) => void;

    // PDF state
    pdfFile: File | null;
    pdfUrl: string | null;
    indexId: string | null;
    isExtracting: boolean;
    totalPages: number;
    currentPage: number;
    scale: number;

    // Chat
    messages: ChatMessage[];
    isAsking: boolean;
    selectedModel: "gemini" | "gpt";

    // Highlights
    activeHighlights: ResolvedHighlight[];
    currentHighlightIndex: number;

    // Actions
    setPdfFile: (file: File | null) => void;
    setPdfUrl: (url: string | null) => void;
    setIndexId: (id: string | null) => void;
    setIsExtracting: (v: boolean) => void;
    setTotalPages: (n: number) => void;
    setCurrentPage: (n: number) => void;
    setScale: (s: number) => void;
    addMessage: (msg: ChatMessage) => void;
    updateLastMessage: (content: string, highlights?: ResolvedHighlight[]) => void;
    finishLastMessage: () => void;
    setIsAsking: (v: boolean) => void;
    setSelectedModel: (m: "gemini" | "gpt") => void;
    setActiveHighlights: (h: ResolvedHighlight[]) => void;
    addActiveHighlight: (h: ResolvedHighlight) => void;
    setCurrentHighlightIndex: (n: number) => void;
    navigateToHighlight: (n: number) => void;
    reset: () => void;
}

export const useAppStore = create<AppState>((set) => ({
    isAuthenticated: false,
    setAuthenticated: (v) => set({ isAuthenticated: v }),

    pdfFile: null,
    pdfUrl: null,
    indexId: null,
    isExtracting: false,
    totalPages: 0,
    currentPage: 1,
    scale: 1.2,

    messages: [],
    isAsking: false,
    selectedModel: "gemini",

    activeHighlights: [],
    currentHighlightIndex: 0,

    setPdfFile: (file) => set({ pdfFile: file }),
    setPdfUrl: (url) => set({ pdfUrl: url }),
    setIndexId: (id) => set({ indexId: id }),
    setIsExtracting: (v) => set({ isExtracting: v }),
    setTotalPages: (n) => set({ totalPages: n }),
    setCurrentPage: (n) => set({ currentPage: n }),
    setScale: (s) => set({ scale: s }),
    addMessage: (msg) => set((state) => ({ messages: [...state.messages, msg] })),
    updateLastMessage: (content, highlights) =>
        set((state) => {
            const msgs = [...state.messages];
            const last = msgs[msgs.length - 1];
            if (last && last.role === "assistant") {
                msgs[msgs.length - 1] = {
                    ...last,
                    content,
                    highlights: highlights ?? last.highlights,
                };
            }
            return { messages: msgs };
        }),
    finishLastMessage: () =>
        set((state) => {
            const msgs = [...state.messages];
            const last = msgs[msgs.length - 1];
            if (last) msgs[msgs.length - 1] = { ...last, isStreaming: false };
            return { messages: msgs };
        }),
    setIsAsking: (v) => set({ isAsking: v }),
    setSelectedModel: (m) => set({ selectedModel: m }),
    setActiveHighlights: (h) => set({ activeHighlights: h, currentHighlightIndex: 0 }),
    addActiveHighlight: (h) =>
        set((state) => ({ activeHighlights: [...state.activeHighlights, h] })),
    setCurrentHighlightIndex: (n) => set({ currentHighlightIndex: n }),
    navigateToHighlight: (n) =>
        set((state) => {
            const hl = state.activeHighlights[n];
            if (!hl) return {};
            return { currentHighlightIndex: n, currentPage: hl.pageNum };
        }),
    reset: () =>
        set({
            pdfFile: null,
            pdfUrl: null,
            indexId: null,
            isExtracting: false,
            totalPages: 0,
            currentPage: 1,
            messages: [],
            isAsking: false,
            activeHighlights: [],
            currentHighlightIndex: 0,
        }),
}));
