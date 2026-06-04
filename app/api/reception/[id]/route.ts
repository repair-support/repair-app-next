import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth";
import { isStoreName, storeFromReceptionId } from "@/lib/constants";
import { apiError } from "@/lib/http";
import {
  removeReceptionFromCustomerMgmt,
  removeReceptionFromPurchaseManagement,
  removeReceptionFromSalesManagement,
  syncReceptionSideEffects,
} from "@/lib/management-sync";
import { deleteReception, getReceptionById, updateReception } from "@/lib/sheets";

async function storeFor(request: NextRequest, id: string) {
  const requested = request.nextUrl.searchParams.get("store");
  return requested && isStoreName(requested) ? requested : storeFromReceptionId(id);
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) return apiError(new Error("認証が必要です。"), 401);
  try {
    const { id } = await params;
    const store = await storeFor(request, id);
    if (!store) return apiError(new Error("店舗を特定できません。"), 400);
    const data = await getReceptionById(store, id);
    return data ? NextResponse.json({ ok: true, data }) : apiError(new Error("受付が見つかりません。"), 404);
  } catch (error) {
    return apiError(error);
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) return apiError(new Error("認証が必要です。"), 401);
  try {
    const { id } = await params;
    const body = await request.json();
    const store = isStoreName(body.storeName) ? body.storeName : storeFromReceptionId(id);
    if (!store) return apiError(new Error("店舗を特定できません。"), 400);
    const updated = await updateReception(store, id, body);
    await syncReceptionSideEffects(updated);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) return apiError(new Error("認証が必要です。"), 401);
  try {
    const { id } = await params;
    const store = await storeFor(request, id);
    if (!store) return apiError(new Error("店舗を特定できません。"), 400);
    const deleted = await deleteReception(store, id);
    await removeReceptionFromCustomerMgmt(deleted);
    await removeReceptionFromSalesManagement(deleted);
    await removeReceptionFromPurchaseManagement(deleted);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
