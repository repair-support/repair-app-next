import { NextRequest, NextResponse } from "next/server";
import { storeFromReceptionId } from "@/lib/constants";
import { apiError } from "@/lib/http";
import { getReceptionById, updateReception } from "@/lib/sheets";

const editableFields = [
  "status",
  "staffName",
  "repairStaff",
  "serviceType",
  "deviceCategory",
  "deviceModel",
  "imei",
  "symptom",
  "repairContent",
  "repairPrice",
  "cost",
  "returnPlanDate",
  "returnDate",
  "internalMemo",
  "notes",
  "waterproofTape",
  "coating",
  "temperedGlass",
  "paymentMethod",
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
] as const;

async function authorizedReception(request: NextRequest, id: string) {
  const store = storeFromReceptionId(id);
  const token = request.nextUrl.searchParams.get("token");
  if (!store || !token) return null;
  const reception = await getReceptionById(store, id);
  return reception?.updateToken === token ? { store, reception } : null;
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const result = await authorizedReception(request, id);
    if (!result) return apiError(new Error("URLが無効です"), 403);
    const data: Partial<typeof result.reception> = { ...result.reception };
    delete data.updateToken;
    return NextResponse.json({ ok: true, data });
  } catch (error) {
    return apiError(error);
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const result = await authorizedReception(request, id);
    if (!result) return apiError(new Error("URLが無効です"), 403);
    const body = await request.json();
    const changes = Object.fromEntries(editableFields.filter((field) => field in body).map((field) => [field, body[field]]));
    await updateReception(result.store, id, changes);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
