import { NextResponse } from "next/server";
import { isLlmConfigured } from "@/lib/reading/llm/config";

/**
 * GET /api/reading/status
 * 仅暴露 boolean llmConfigured，禁止返回任何 Key / base URL / model。
 */
export async function GET() {
  return NextResponse.json({
    data: {
      llmConfigured: isLlmConfigured(),
    },
  });
}
