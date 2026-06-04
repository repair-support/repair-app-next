import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth";
import { apiError } from "@/lib/http";
import { getStatusLists, getStatuses, updateStatusLists } from "@/lib/sheets";

export async function GET(request: NextRequest) {
  try {
    if (request.nextUrl.searchParams.get("mode") === "lists") {
      return NextResponse.json({ ok: true, data: await getStatusLists() });
    }
    return NextResponse.json({ ok: true, data: await getStatuses() });
  } catch (error) {
    return apiError(error);
  }
}

export async function PUT(request: NextRequest) {
  if (!(await isAdmin())) return apiError(new Error("管理権限が必要です"), 403);
  try {
    const body = await request.json();
    const repairStatuses = Array.isArray(body.repairStatuses) ? body.repairStatuses.map(String) : [];
    const purchaseStatuses = Array.isArray(body.purchaseStatuses) ? body.purchaseStatuses.map(String) : [];
    return NextResponse.json({ ok: true, data: await updateStatusLists(repairStatuses, purchaseStatuses) });
  } catch (error) {
    return apiError(error);
  }
}
