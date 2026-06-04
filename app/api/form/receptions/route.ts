import { NextRequest, NextResponse } from "next/server";
import { isStoreName } from "@/lib/constants";
import { apiError } from "@/lib/http";
import { getReceptions, getStatusLists } from "@/lib/sheets";
import { isInitialStatusForService } from "@/lib/status-options";

export async function GET(request: NextRequest) {
  try {
    const store = request.nextUrl.searchParams.get("store") ?? "";
    if (!isStoreName(store)) return apiError(new Error("店舗名が不正です。"), 400);
    const statusLists = await getStatusLists();
    const data = (await getReceptions(store))
      .filter((item) => isInitialStatusForService(statusLists, item.serviceType, item.status))
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
