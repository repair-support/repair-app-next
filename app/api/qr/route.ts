import { NextRequest, NextResponse } from "next/server";
import QRCode from "qrcode";
import { apiError } from "@/lib/http";

export async function POST(request: NextRequest) {
  try {
    const { text } = await request.json();
    if (!text || typeof text !== "string") return apiError(new Error("textが必要です"), 400);
    return NextResponse.json({ ok: true, dataUrl: await QRCode.toDataURL(text, { margin: 1, width: 320 }) });
  } catch (error) {
    return apiError(error);
  }
}
