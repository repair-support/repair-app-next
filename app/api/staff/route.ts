import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth";
import { isStoreName } from "@/lib/constants";
import { apiError } from "@/lib/http";
import { getReceptionStaffOptions, getStaffOptions, updateStaffOptions } from "@/lib/sheets";

export async function GET(request: NextRequest) {
  try {
    const store = request.nextUrl.searchParams.get("store") ?? "";
    if (!isStoreName(store)) return apiError(new Error("店舗名が不正です"), 400);
    const mode = request.nextUrl.searchParams.get("mode");
    const data = mode === "staff" ? await getStaffOptions(store) : await getReceptionStaffOptions(store);
    return NextResponse.json({ ok: true, data });
  } catch (error) {
    return apiError(error);
  }
}

export async function PUT(request: NextRequest) {
  if (!(await isAdmin())) return apiError(new Error("管理権限が必要です"), 403);
  try {
    const body = await request.json();
    if (!isStoreName(body.storeName)) return apiError(new Error("店舗名が不正です"), 400);
    if (!Array.isArray(body.staffNames)) return apiError(new Error("スタッフ名を配列で指定してください"), 400);
    const staffList = await updateStaffOptions(body.storeName, body.staffNames);
    return NextResponse.json({ ok: true, data: staffList });
  } catch (error) {
    return apiError(error);
  }
}
