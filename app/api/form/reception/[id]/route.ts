import { NextRequest, NextResponse } from "next/server";
import { storeFromReceptionId } from "@/lib/constants";
import { apiError } from "@/lib/http";
import { syncReceptionSideEffects } from "@/lib/management-sync";
import { getReceptionById, getStatusLists, updateReception } from "@/lib/sheets";
import { completedStatusFromLists, isInitialStatusForService } from "@/lib/status-options";

const customerFields = [
  "customerName",
  "customerKana",
  "deviceTel",
  "completeTel",
  "birthdate",
  "homeTel",
  "mobileTel",
  "email",
  "occupation",
  "address",
  "repairHistory",
  "passcode",
  "serviceType",
  "deviceCategory",
  "deviceModel",
  "imei",
  "symptom",
  "repairContent",
  "repairPrice",
  "cost",
  "repairCategory",
  "panelType",
  "smallPartsType",
  "waterproofTape",
  "warrantyStatus",
  "devicesJson",
  "paymentMethod",
  "coating",
  "temperedGlass",
  "idDocuments",
  "purchaseAgreement",
  "color",
  "carrier",
  "simLock",
  "capacity",
  "usageRestriction",
  "rank",
  "repairParts",
  "btLevel",
  "accessories",
  "itemCount",
  "assessStaff",
  "notes",
  "agreement",
  "signatureData",
] as const;

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const store = storeFromReceptionId(id);
    const body = await request.json();
    if (!store) return apiError(new Error("受付番号が無効です。"), 403);

    const current = await getReceptionById(store, id);
    const nextServiceType = body.serviceType ?? current?.serviceType;
    const statusLists = await getStatusLists();
    const canFillExisting = isInitialStatusForService(statusLists, nextServiceType, current?.status) && !body.updateToken;
    const hasValidToken = current?.updateToken === body.updateToken;
    if (!current || (!canFillExisting && !hasValidToken)) return apiError(new Error("受付番号が無効です。"), 403);

    const changes = Object.fromEntries(customerFields.map((field) => [field, body[field] ?? ""]));
    const updated = await updateReception(store, id, { ...changes, status: completedStatusFromLists(statusLists, nextServiceType) });
    await syncReceptionSideEffects(updated);
    return NextResponse.json({ ok: true, receptionId: id, updateToken: current.updateToken });
  } catch (error) {
    return apiError(error);
  }
}
