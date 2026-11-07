import { NextResponse } from "next/server";
import {
  ClashError,
  createBooking,
  isValidPhone,
  isValidStay,
  listBookings,
} from "@/lib/availability";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ bookings: listBookings() });
}

export async function POST(req: Request) {
  let b: any;
  try {
    b = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const { roomId, guestName, phone, checkIn, checkOut } = b ?? {};

  // Validation first (400), clash check after (409).
  if (!Number.isInteger(roomId))
    return NextResponse.json({ error: "roomId is required" }, { status: 400 });
  if (typeof guestName !== "string" || !guestName.trim())
    return NextResponse.json({ error: "Guest name is required" }, { status: 400 });
  if (!isValidPhone(phone))
    return NextResponse.json({ error: "Phone must be exactly 10 digits" }, { status: 400 });
  if (!isValidStay(checkIn, checkOut))
    return NextResponse.json({ error: "Check-out must be after check-in" }, { status: 400 });

  try {
    const booking = createBooking(roomId, guestName.trim(), phone, checkIn, checkOut);
    return NextResponse.json(booking, { status: 201 });
  } catch (e) {
    if (e instanceof ClashError)
      return NextResponse.json({ error: e.message }, { status: 409 });
    if ((e as Error).message === "NO_ROOM")
      return NextResponse.json({ error: "Room not found" }, { status: 404 });
    throw e;
  }
}
