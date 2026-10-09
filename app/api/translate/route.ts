import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { requireAdmin } from "@/lib/admin";
export async function POST(request: NextRequest) {
  const denied = requireAdmin(request);
  if (denied) return denied;
  if (!process.env.OPENAI_API_KEY)
    return NextResponse.json(
      { error: "OPENAI_API_KEY is not configured" },
      { status: 503 },
    );
  try {
    const { title, summary, body } = await request.json();
    const ai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const completion = await ai.chat.completions.create({
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "Translate financial news into clear, natural Khmer for Cambodian retail readers. Keep company names, tickers, dates, figures, and market terminology accurate. Do not add claims or investment advice. Return JSON with title, summary, body.",
        },
        { role: "user", content: JSON.stringify({ title, summary, body }) },
      ],
    });
    return NextResponse.json(
      JSON.parse(completion.choices[0]?.message?.content || "{}"),
    );
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Translation failed" },
      { status: 500 },
    );
  }
}
