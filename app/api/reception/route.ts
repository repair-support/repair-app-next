import { NextRequest, NextResponse } from "next/server";
import { isStoreName } from "@/lib/constants";
import { apiError } from "@/lib/http";
import { createReception } from "@/lib/sheets";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    if (!isStoreName(body.storeName)) return apiError(new Error("店舗名が不正です。"), 400);
    if (!body.serviceType) return apiError(new Error("サービス媒体を選択してください。"), 400);
    const result = await createReception(body.storeName, {
      staffName: body.staffName ?? "",
      serviceType: body.serviceType,
      status: "受付中",
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return apiError(error);
  }
}
