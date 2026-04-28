import { NextRequest, NextResponse } from "next/server";
import { validateToken } from "@ocular/pdf";

export async function POST(request: NextRequest) {
    try {
        const { token } = await request.json();

        if (validateToken(token)) {
            return NextResponse.json({ valid: true });
        }

        return NextResponse.json({ valid: false, error: "Invalid access token" }, { status: 401 });
    } catch {
        return NextResponse.json({ valid: false, error: "Invalid request" }, { status: 400 });
    }
}
