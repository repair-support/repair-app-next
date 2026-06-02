import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth";
import { isStoreName } from "@/lib/constants";
import { apiError } from "@/lib/http";
import { getReceptions } from "@/lib/sheets";

export async function GET(request: NextRequest) {
  if (!(await isAdmin())) return apiError(new Error("認証が必要です"), 401);
  try {
    const store = request.nextUrl.searchParams.get("store") ?? "";
    if (!isStoreName(store)) return apiError(new Error("店舗名が不正です"), 400);
    const status = request.nextUrl.searchParams.get("status");
    const q = request.nextUrl.searchParams.get("q")?.toLowerCase();
    let data = await getReceptions(store);
    if (status) data = data.filter((item) => item.status === status);
    if (q) data = data.filter((item) => `${item.receptionId} ${item.customerName}`.toLowerCase().includes(q));
    return NextResponse.json({ ok: true, data });
  } catch (error) {
    return apiError(error);
  }
}
