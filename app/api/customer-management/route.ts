import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth";
import { apiError } from "@/lib/http";
import { getCustomerMgmtLinks } from "@/lib/management-sync";

export async function GET() {
  if (!(await isAdmin())) return apiError(new Error("管理権限が必要です"), 403);
  try {
    const links = await getCustomerMgmtLinks();
    return NextResponse.json({ links });
  } catch (error) {
    return apiError(error);
  }
}
