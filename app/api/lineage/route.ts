import { NextRequest, NextResponse } from "next/server";
import { courtFailure } from "@/lib/lobby/failure";
import { lineages } from "@/lib/lobby/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    return NextResponse.json(await lineages(request.nextUrl.searchParams.get("lobby") || undefined), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Lineage request failed", error);
    return NextResponse.json({ error: courtFailure(error) }, { status: 503 });
  }
}
