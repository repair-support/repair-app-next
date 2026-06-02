import { NextRequest, NextResponse } from "next/server";
import { storeFromReceptionId } from "@/lib/constants";
import { apiError } from "@/lib/http";
import { getReceptionById, updateReception } from "@/lib/sheets";

const customerFields = [
  "customerName",
  "customerKana",
  "deviceTel",
  "completeTel",
  "address",
  "repairHistory",
  "passcode",
  "agreement",
  "signatureData",
] as const;

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const store = storeFromReceptionId(id);
    const body = await request.json();
    if (!store) return apiError(new Error("受付番号が無効です"), 403);
    const current = await getReceptionById(store, id);
    const canFillExisting = current?.status === "受付中" && !body.updateToken;
    const hasValidToken = current?.updateToken === body.updateToken;
    if (!current || (!canFillExisting && !hasValidToken)) return apiError(new Error("受付番号が無効です"), 403);
    const changes = Object.fromEntries(customerFields.map((field) => [field, body[field] ?? ""]));
    await updateReception(store, id, { ...changes, status: "受付済み" });
    return NextResponse.json({ ok: true, receptionId: id, updateToken: current.updateToken });
  } catch (error) {
    return apiError(error);
  }
}
