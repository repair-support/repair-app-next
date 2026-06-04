import { NextResponse } from "next/server";
import { apiError } from "@/lib/http";
import { getCostReferenceData } from "@/lib/sheets";

export async function GET() {
  try {
    return NextResponse.json({ ok: true, data: await getCostReferenceData() });
  } catch (error) {
    return apiError(error);
  }
}
