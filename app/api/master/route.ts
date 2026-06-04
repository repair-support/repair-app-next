import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth";
import { apiError } from "@/lib/http";
import { addMasterModel, addMasterRepair, getMasterData } from "@/lib/sheets";

export async function GET() {
  try {
    return NextResponse.json({ ok: true, data: await getMasterData() });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: NextRequest) {
  if (!(await isAdmin())) return apiError(new Error("管理権限が必要です"), 403);
  try {
    const body = await request.json();
    if (body.action === "addModel") {
      return NextResponse.json({ ok: true, data: await addMasterModel(String(body.category ?? ""), String(body.model ?? "")) });
    }
    if (body.action === "addRepair") {
      return NextResponse.json({ ok: true, data: await addMasterRepair(String(body.model ?? ""), String(body.repair ?? "")) });
    }
    return apiError(new Error("未対応の操作です"), 400);
  } catch (error) {
    return apiError(error);
  }
}
