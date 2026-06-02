import { NextResponse } from "next/server";
import { apiError } from "@/lib/http";
import { getMasterData } from "@/lib/sheets";

export async function GET() {
  try {
    return NextResponse.json({ ok: true, data: await getMasterData() });
  } catch (error) {
    return apiError(error);
  }
}
