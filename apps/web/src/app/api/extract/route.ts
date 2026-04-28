import { NextRequest, NextResponse } from "next/server";
import { validateToken, checkRateLimit, getClientId, extractAndIndexBuffer } from "@ocular/pdf";

// In-memory store for position indices (keyed by ID)
const indexStore = new Map<string, unknown>();

export function getStoredIndex(id: string) {
    return indexStore.get(id);
}

export async function POST(request: NextRequest) {
    try {
        const token = request.headers.get("x-auth-token");
        if (!validateToken(token)) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
        const { allowed } = checkRateLimit(getClientId(request.headers));
        if (!allowed) {
            return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
        }

        const formData = await request.formData();
        const file = formData.get("pdf") as File | null;
        if (!file) {
            return NextResponse.json({ error: "No PDF file provided" }, { status: 400 });
        }

        const buffer = Buffer.from(await file.arrayBuffer());
        
        // Run the extractor (uses default pythonDir from @ocular/pdf package)
        const index = await extractAndIndexBuffer(buffer);

        // Store in memory
        const indexId = crypto.randomUUID();
        indexStore.set(indexId, index);

        // Auto-cleanup after 30 mins
        setTimeout(() => indexStore.delete(indexId), 30 * 60 * 1000);

        return NextResponse.json({
            indexId,
            totalPages: index.totalPages,
            textLength: index.fullText.length,
        });
    } catch (error) {
        console.error("Extract error:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Extraction failed" },
            { status: 500 }
        );
    }
}
