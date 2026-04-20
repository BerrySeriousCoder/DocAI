/**
 * @docai/backend — LLM Service
 *
 * Unified interface for querying Gemini and GPT models.
 * Supports both streaming text and structured JSON output via Zod schemas.
 */

import { initBackendConfig, getRequiredConfig } from "./config.js";
import { GoogleGenAI, Type } from "@google/genai";
import OpenAI from "openai";
import { z } from "zod";

// Ensure backend .env is loaded
initBackendConfig();

export type ModelProvider = "gemini" | "gpt";

export interface LLMStreamOptions {
    model: ModelProvider;
    systemPrompt: string;
    userMessage: string;
}

// ─── Structured output schema ────────────────────────────────────────────────
// This is what the AI returns: an answer + an array of verbatim quotes
export const DocumentAnswerSchema = z.object({
    answer: z.string().describe("Your full answer to the user's question, with natural language explanation. Use markdown for formatting."),
    quotes: z.array(
        z.string().describe("A verbatim quote from the document that supports a claim in your answer. Must be copied CHARACTER-FOR-CHARACTER from the document text. Keep it as concise as possible, even if it's a single word or ID. No markdown formatting, no page markers.")
    ).describe("Array of exact verbatim quotes from the document that support your answer."),
});

export type DocumentAnswer = z.infer<typeof DocumentAnswerSchema>;

// ─── Gemini JSON Schema (manual conversion from Zod) ─────────────────────────
const geminiResponseSchema = {
    type: Type.OBJECT,
    properties: {
        answer: {
            type: Type.STRING,
            description: "Full answer to the user's question with natural language explanation.",
        },
        quotes: {
            type: Type.ARRAY,
            items: {
                type: Type.STRING,
                description: "A verbatim quote from the document (keep it concise, even a single word/ID, no markdown).",
            },
            description: "Array of exact verbatim quotes from the document.",
        },
    },
    required: ["answer", "quotes"],
};

// ─── Streaming text output (kept for backward compatibility) ──────────────────
export async function* streamLLMResponse(options: LLMStreamOptions): AsyncGenerator<string> {
    const { model, systemPrompt, userMessage } = options;

    if (model === "gpt") {
        const apiKey = getRequiredConfig("OPENAI_API_KEY");

        const openai = new OpenAI({ apiKey });
        const completion = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: userMessage },
            ],
            stream: true,
            max_tokens: 2000,
        });

        for await (const chunk of completion) {
            const delta = chunk.choices[0]?.delta?.content;
            if (delta) yield delta;
        }
    } else {
        const apiKey = getRequiredConfig("GEMINI_API_KEY");

        const ai = new GoogleGenAI({ apiKey });
        const response = await ai.models.generateContentStream({
            model: "gemini-2.5-flash",
            contents: [
                { role: "user", parts: [{ text: `${systemPrompt}\n\nQuestion: ${userMessage}` }] },
            ],
            config: { maxOutputTokens: 2000 },
        });

        for await (const chunk of response) {
            const text = chunk.text;
            if (text) yield text;
        }
    }
}

// ─── Structured JSON output (new) ────────────────────────────────────────────
export async function getLLMStructuredResponse(options: LLMStreamOptions): Promise<DocumentAnswer> {
    const { model, systemPrompt, userMessage } = options;

    if (model === "gpt") {
        const apiKey = getRequiredConfig("OPENAI_API_KEY");

        const openai = new OpenAI({ apiKey });
        const completion = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: userMessage },
            ],
            max_tokens: 16384,
            response_format: {
                type: "json_schema",
                json_schema: {
                    name: "document_answer",
                    strict: true,
                    schema: {
                        type: "object",
                        properties: {
                            answer: { type: "string", description: "Full answer to the user's question." },
                            quotes: {
                                type: "array",
                                items: { type: "string" },
                                description: "Array of exact verbatim quotes from the document.",
                            },
                        },
                        required: ["answer", "quotes"],
                        additionalProperties: false,
                    },
                },
            },
        });

        const content = completion.choices[0]?.message?.content;
        if (!content) throw new Error("No response from GPT");

        const parsed = JSON.parse(content);
        return DocumentAnswerSchema.parse(parsed);
    } else {
        const apiKey = getRequiredConfig("GEMINI_API_KEY");

        const ai = new GoogleGenAI({ apiKey });
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: [
                { role: "user", parts: [{ text: `${systemPrompt}\n\nQuestion: ${userMessage}` }] },
            ],
            config: {
                maxOutputTokens: 8192,
                responseMimeType: "application/json",
                responseSchema: geminiResponseSchema,
            },
        });

        const text = response.text;
        if (!text) throw new Error("No response from Gemini");

        const parsed = JSON.parse(text);
        return DocumentAnswerSchema.parse(parsed);
    }
}
