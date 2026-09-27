import { NextResponse } from "next/server";
import { lineages } from "@/lib/lobby/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json(await lineages(), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Lineage request failed", error);
    return NextResponse.json({ error: "The court is reconnecting..." }, { status: 503 });
  }
}
