import { NextRequest } from "next/server";
import { validateToken, checkRateLimit, getClientId, getLLMStructuredResponse, resolveHighlight, getSpansForHighlight } from "@ocular/pdf";
import type { ModelProvider, PdfPositionIndex } from "@ocular/pdf";
import { getStoredIndex } from "../extract/route";

export async function POST(request: NextRequest) {
    try {
        const token = request.headers.get("x-auth-token");
        if (!validateToken(token)) {
            return new Response("Unauthorized", { status: 401 });
        }
        const { allowed } = checkRateLimit(getClientId(request.headers));
        if (!allowed) {
            return new Response("Rate limit exceeded", { status: 429 });
        }

        const { question, indexId, model } = await request.json();
        if (!question || !indexId) {
            return new Response("Missing question or indexId", { status: 400 });
        }

        const index = getStoredIndex(indexId) as PdfPositionIndex | undefined;

        if (!index) {
            return new Response("Index not found — please re-upload the PDF", { status: 404 });
        }

        const systemPrompt = `You are a precise document analysis AI. The user uploaded a PDF and will ask questions about it.

RULES:
1. Answer based ONLY on the document text below.
2. For EVERY claim in your answer, include the exact supporting text in the "quotes" array.
3. Quotes must be CHARACTER-FOR-CHARACTER copies from the document. No paraphrasing, no reformatting.
4. Keep each quote as concise as possible. If the answer is a specific number, ID, or short phrase, quote EXACTLY that short string. Do not copy entire paragraphs.
5. If the answer is not in the document, say so and return an empty quotes array.

DOCUMENT TEXT:
${index.fullText}`;

        const encoder = new TextEncoder();
        const stream = new ReadableStream({
            async start(controller) {
                const sendEvent = (data: unknown) => {
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
                };

                try {
                    // Send a "thinking" indicator while we wait for structured response
                    sendEvent({ type: "token", content: "" });

                    // Get structured response from LLM
                    const result = await getLLMStructuredResponse({
                        model: (model || "gemini") as ModelProvider,
                        systemPrompt,
                        userMessage: question,
                    });

                    console.log("[Ask API] AI Answer:", result.answer);
                    console.log("[Ask API] AI Quotes:", result.quotes);

                    // Send the answer text as a single token event
                    sendEvent({ type: "token", content: result.answer });

                    // Resolve each quote from the structured output
                    const resolvedHighlights: Array<{ pageNum: number; charStart: number; charEnd: number; spans: any; text: string }> = [];
                    for (const quote of result.quotes) {
                        if (quote && quote.length >= 3) {
                            const highlight = resolveHighlight(index, quote);
                            if (highlight) {
                                const isDup = resolvedHighlights.some(ex => 
                                    ex.pageNum === highlight.pageNum && 
                                    Math.max(ex.charStart, highlight.charStart) < Math.min(ex.charEnd, highlight.charEnd)
                                );
                                if (!isDup) {
                                    const spans = getSpansForHighlight(index, highlight);
                                    const h = { ...highlight, text: quote, spans };
                                    resolvedHighlights.push(h);
                                    sendEvent({ type: "highlight", highlight: h });
                                }
                            }
                        }
                    }

                    sendEvent({ type: "done", highlights: resolvedHighlights, fullText: result.answer });
                } catch (error) {
                    sendEvent({ type: "error", error: error instanceof Error ? error.message : "Unknown error" });
                }

                controller.close();
            },
        });

        return new Response(stream, {
            headers: {
                "Content-Type": "text/event-stream",
                "Cache-Control": "no-cache",
                Connection: "keep-alive",
            },
        });
    } catch (error) {
        return new Response(error instanceof Error ? error.message : "Unknown error", { status: 500 });
    }
}

