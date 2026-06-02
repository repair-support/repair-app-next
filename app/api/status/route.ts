import { NextResponse } from "next/server";
import { apiError } from "@/lib/http";
import { getStatuses } from "@/lib/sheets";

export async function GET() {
  try {
    return NextResponse.json({ ok: true, data: await getStatuses() });
  } catch (error) {
    return apiError(error);
  }
}
