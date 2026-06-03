import { NextRequest, NextResponse } from "next/server";
import { isStoreName } from "@/lib/constants";
import { apiError } from "@/lib/http";
import { getReceptions } from "@/lib/sheets";

export async function GET(request: NextRequest) {
  try {
    const store = request.nextUrl.searchParams.get("store") ?? "";
    if (!isStoreName(store)) return apiError(new Error("店舗名が不正です。"), 400);
    const data = (await getReceptions(store))
      .filter((item) => item.status === "受付中")
      .map((item) => ({
        receptionId: item.receptionId,
        rowNumber: item.rowNumber,
        serviceType: item.serviceType,
        customerName: item.customerName,
        deviceModel: item.deviceModel,
      }));
    return NextResponse.json({ ok: true, data });
  } catch (error) {
    return apiError(error);
  }
}
