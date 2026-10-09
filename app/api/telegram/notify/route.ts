import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";

export async function POST(request: NextRequest) {
  const denied = requireAdmin(request);
  if (denied) return denied;

  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId)
    return NextResponse.json(
      { error: "Telegram bot credentials are not configured" },
      { status: 503 },
    );

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const message =
    body && typeof body === "object" && "text" in body
      ? (body as { text?: unknown }).text
      : null;
  if (typeof message !== "string" || !message.trim() || message.length > 4096)
    return NextResponse.json({ error: "Invalid message" }, { status: 400 });

  try {
    const response = await fetch(
      `https://api.telegram.org/bot${token}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: message,
          parse_mode: "HTML",
          disable_web_page_preview: false,
        }),
      },
    );
    const result = await response.json();
    return NextResponse.json(result, { status: response.ok ? 200 : 502 });
  } catch {
    return NextResponse.json(
      { error: "Telegram delivery failed" },
      { status: 502 },
    );
  }
}
