import { NextResponse } from "next/server";
import { findFreeRooms, isValidStay } from "@/lib/availability";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const p = new URL(req.url).searchParams;
  const checkIn = p.get("checkIn") ?? "";
  const checkOut = p.get("checkOut") ?? "";
  const category = p.get("category") || undefined;

  if (!isValidStay(checkIn, checkOut)) {
    return NextResponse.json(
      { error: "Enter valid dates. Check-out must be after check-in." },
      { status: 400 }
    );
  }
  return NextResponse.json({ rooms: findFreeRooms(checkIn, checkOut, category) });
}
