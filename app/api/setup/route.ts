import { NextResponse } from "next/server";
import { isSetupAdmin } from "@/lib/auth";
import { apiError } from "@/lib/http";
import { setupSpreadsheet } from "@/lib/sheets";

export async function POST() {
  if (!(await isSetupAdmin())) return apiError(new Error("管理者権限が必要です"), 403);
  try {
    await setupSpreadsheet();
    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
