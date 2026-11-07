import { NextResponse } from "next/server";
import { cancelBooking } from "@/lib/availability";

export const dynamic = "force-dynamic";

// PATCH /api/bookings/:id  -> cancels the booking
export async function PATCH(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  if (!Number.isInteger(id))
    return NextResponse.json({ error: "Invalid booking id" }, { status: 400 });
  if (!cancelBooking(id))
    return NextResponse.json({ error: "Booking not found or already cancelled" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
