import { NextResponse } from "next/server";

const APPS_SCRIPT_URL =
  process.env.NEXTWEEK_APPS_SCRIPT_URL ||
  "https://script.google.com/macros/s/AKfycbymvlERasRoiRzeZ93fggmx1tnEEOPKaZHaYp7YUaPatcBX19_B8GXDb62RzIwrtSh5nQ/exec";

export const dynamic = "force-dynamic";

export async function GET() {
  const response = await fetch(`${APPS_SCRIPT_URL}?action=data`, {
    cache: "no-store",
    redirect: "follow",
  });

  const text = await response.text();
  if (!response.ok) {
    return NextResponse.json(
      { error: `Apps Script API error: ${response.status}`, detail: text.slice(0, 500) },
      { status: 502 },
    );
  }

  try {
    return NextResponse.json(JSON.parse(text));
  } catch {
    return NextResponse.json(
      { error: "Apps Script API did not return JSON", detail: text.slice(0, 500) },
      { status: 502 },
    );
  }
}
