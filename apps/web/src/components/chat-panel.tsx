"use client";

import { useState, useRef, useEffect } from "react";
import { Send, Sparkles, Loader2 } from "lucide-react";
import { useAppStore, type ResolvedHighlight } from "@/lib/store";

export default function ChatPanel() {
    const {
        messages, addMessage, updateLastMessage, finishLastMessage,
        isAsking, setIsAsking, indexId, selectedModel, setSelectedModel,
        setActiveHighlights, addActiveHighlight, setCurrentPage,
    } = useAppStore();

    const [input, setInput] = useState("");
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const authToken = typeof window !== "undefined" ? localStorage.getItem("docai_token") : null;

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    const handleAsk = async () => {
        if (!input.trim() || !indexId || isAsking) return;

        const question = input.trim();
        setInput("");
        setIsAsking(true);
        setActiveHighlights([]);

        // Add user message
        addMessage({ id: crypto.randomUUID(), role: "user", content: question });

        // Add empty assistant message
        addMessage({ id: crypto.randomUUID(), role: "assistant", content: "", isStreaming: true, highlights: [] });

        try {
            const res = await fetch("/api/ask", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    ...(authToken ? { "x-auth-token": authToken } : {}),
                },
                body: JSON.stringify({ question, indexId, model: selectedModel }),
            });

            if (!res.ok) {
                const text = await res.text();
                updateLastMessage(`Error: ${text}`);
                finishLastMessage();
                setIsAsking(false);
                return;
            }

            const reader = res.body?.getReader();
            const decoder = new TextDecoder();
            let fullContent = "";
            const seenHighlights = new Set<string>();

            if (reader) {
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;

                    const text = decoder.decode(value, { stream: true });
                    const lines = text.split("\n");

                    for (const line of lines) {
                        if (!line.startsWith("data: ")) continue;
                        try {
                            const data = JSON.parse(line.slice(6));

                            if (data.type === "token") {
                                fullContent += data.content;
                                updateLastMessage(fullContent);
                            } else if (data.type === "highlight") {
                                const h = data.highlight as ResolvedHighlight;
                                const key = `${h.pageNum}:${h.charStart}:${h.charEnd}`;
                                if (!seenHighlights.has(key)) {
                                    seenHighlights.add(key);
                                    addActiveHighlight(h);
                                    // Auto-navigate only on first highlight; rest accumulate
                                    if (seenHighlights.size === 1) {
                                        setCurrentPage(h.pageNum);
                                    }
                                }
                            } else if (data.type === "done") {
                                if (data.fullText) {
                                    updateLastMessage(data.fullText, data.highlights || []);
                                }
                            } else if (data.type === "error") {
                                fullContent += `\n\n⚠️ ${data.error}`;
                                updateLastMessage(fullContent);
                            }
                        } catch {
                            // Ignore malformed SSE lines
                        }
                    }
                }
            }
        } catch (err) {
            updateLastMessage(`Error: ${err instanceof Error ? err.message : "Connection failed"}`);
        }

        finishLastMessage();
        setIsAsking(false);
    };

    return (
        <div className="flex flex-col h-full">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-color)]">
                <div className="flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-[var(--accent)]" />
                    <h2 className="font-semibold text-sm">Ask about your document</h2>
                </div>
                <ModelSelector model={selectedModel} onChange={setSelectedModel} />
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.length === 0 && (
                    <div className="flex flex-col items-center justify-center h-full text-center opacity-50">
                        <Sparkles className="w-10 h-10 mb-3 text-[var(--accent)]" />
                        <p className="text-sm text-[var(--text-secondary)]">Upload a PDF and ask a question.</p>
                        <p className="text-xs text-[var(--text-muted)] mt-1">AI will highlight relevant parts in real-time.</p>
                    </div>
                )}

                {messages.map((msg) => (
                    <div
                        key={msg.id}
                        className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                    >
                        <div
                            className={`max-w-[85%] px-4 py-3 text-sm leading-relaxed ${msg.role === "user"
                                ? "bg-[var(--text-primary)] text-[var(--bg-primary)] font-medium rounded-2xl rounded-br-md"
                                : "bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded-2xl rounded-bl-md"
                                }`}
                        >
                            {msg.role === "assistant" ? (
                                <div className="space-y-1">
                                    {msg.content.split("\n").map((line, i) => {
                                        if (line.startsWith("📌 ")) {
                                            return (
                                                <p key={i} className="text-xs bg-[var(--highlight-bg)] border-l-2 border-[var(--highlight-border)] px-2 py-1 rounded-r text-[var(--warning)] italic">
                                                    {line}
                                                </p>
                                            );
                                        }
                                        return line ? <p key={i}>{line}</p> : <br key={i} />;
                                    })}
                                    {msg.isStreaming && (
                                        <span className="inline-block w-2 h-4 bg-[var(--accent)] animate-pulse rounded-sm ml-1" />
                                    )}
                                </div>
                            ) : (
                                <p>{msg.content}</p>
                            )}
                        </div>
                    </div>
                ))}
                <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="p-4 border-t border-[var(--border-color)] bg-[var(--bg-primary)]">
                <div className="relative flex items-center border border-[var(--border-color)] bg-[var(--bg-secondary)] rounded-md focus-within:ring-1 focus-within:ring-[var(--border-active)] focus-within:border-[var(--border-active)] transition-all shadow-sm">
                    <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleAsk()}
                        placeholder={indexId ? "Ask about your document..." : "Upload a PDF first..."}
                        disabled={!indexId || isAsking}
                        className="flex-1 bg-transparent text-sm py-3 pl-4 pr-12 outline-none placeholder:text-[var(--text-muted)] disabled:opacity-40"
                    />
                    <button
                        onClick={handleAsk}
                        disabled={!input.trim() || !indexId || isAsking}
                        className="absolute right-1.5 top-1/2 -translate-y-1/2 w-8 h-8 rounded text-[var(--bg-primary)] bg-[var(--accent)] flex items-center justify-center disabled:opacity-30 hover:bg-opacity-90 transition-all font-bold"
                    >
                        {isAsking ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                            <Send className="w-4 h-4" />
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}

function ModelSelector({ model, onChange }: { model: string; onChange: (m: "gemini" | "gpt") => void }) {
    return (
        <select
            value={model}
            onChange={(e) => onChange(e.target.value as "gemini" | "gpt")}
            className="text-xs bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded-lg px-2 py-1.5 text-[var(--text-secondary)] outline-none cursor-pointer hover:border-[var(--border-active)] transition-colors"
        >
            <option value="gemini">Gemini 2.5 Flash</option>
            <option value="gpt">GPT-4o Mini</option>
        </select>
    );
}
