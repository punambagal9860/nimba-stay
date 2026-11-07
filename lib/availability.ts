import db from "./db";

// All booking rules live in this file.
//
// Two stays overlap when:
//   existing.check_in < new.checkOut  AND  existing.check_out > new.checkIn
// Strict < and > mean a guest leaving on the 20th does not block one arriving on the 20th.

export type FreeRoom = {
  id: number;
  number: string;
  category: string;
  pricePerNight: number;
  nights: number;
  totalPrice: number;
};

export class ClashError extends Error {}

export function isValidDate(s: unknown): s is string {
  if (typeof s !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(s + "T00:00:00Z");
  return !isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s; // rejects 2026-02-31
}

export function nightsBetween(checkIn: string, checkOut: string): number {
  return Math.round(
    (Date.parse(checkOut + "T00:00:00Z") - Date.parse(checkIn + "T00:00:00Z")) / 86_400_000
  );
}

export function isValidStay(checkIn: unknown, checkOut: unknown): boolean {
  return isValidDate(checkIn) && isValidDate(checkOut) && nightsBetween(checkIn, checkOut) >= 1;
}

export function isValidPhone(phone: unknown): boolean {
  return typeof phone === "string" && /^\d{10}$/.test(phone);
}

// Rooms free for the WHOLE stay.
export function findFreeRooms(checkIn: string, checkOut: string, category?: string): FreeRoom[] {
  const rows = db
    .prepare(
      `SELECT r.id, r.number, r.category, r.price_per_night
       FROM rooms r
       WHERE r.status != 'maintenance'
         AND (@category IS NULL OR r.category = @category)
         AND NOT EXISTS (
           SELECT 1 FROM bookings b
           WHERE b.room_id = r.id
             AND b.status != 'cancelled'
             AND b.check_in < @checkOut
             AND b.check_out > @checkIn
         )
       ORDER BY r.number`
    )
    .all({ checkIn, checkOut, category: category ?? null }) as {
    id: number;
    number: string;
    category: string;
    price_per_night: number;
  }[];

  const nights = nightsBetween(checkIn, checkOut);
  return rows.map((r) => ({
    id: r.id,
    number: r.number,
    category: r.category,
    pricePerNight: r.price_per_night,
    nights,
    totalPrice: nights * r.price_per_night,
  }));
}

// Check + insert happen in ONE transaction. `.immediate` takes the write lock first,
// so two simultaneous requests cannot both pass the check.
const createBookingTx = db.transaction(
  (roomId: number, guestName: string, phone: string, checkIn: string, checkOut: string) => {
    const room = db.prepare("SELECT * FROM rooms WHERE id = ?").get(roomId) as
      | { id: number; price_per_night: number }
      | undefined;
    if (!room) throw new Error("NO_ROOM");

    // findFreeRooms already excludes maintenance rooms and any overlapping active booking.
    const free = findFreeRooms(checkIn, checkOut).some((r) => r.id === roomId);
    if (!free) throw new ClashError("Room is not available for those dates");

    const totalPrice = nightsBetween(checkIn, checkOut) * room.price_per_night;
    const info = db
      .prepare(
        `INSERT INTO bookings (room_id, guest_name, phone, check_in, check_out, total_price)
         VALUES (?,?,?,?,?,?)`
      )
      .run(roomId, guestName, phone, checkIn, checkOut, totalPrice);

    return {
      id: Number(info.lastInsertRowid),
      roomId,
      guestName,
      phone,
      checkIn,
      checkOut,
      totalPrice,
    };
  }
);
export const createBooking = createBookingTx.immediate;

export function listBookings() {
  return db
    .prepare(
      `SELECT b.id, r.number AS roomNumber, r.category, b.guest_name AS guestName, b.phone,
              b.check_in AS checkIn, b.check_out AS checkOut, b.total_price AS totalPrice
       FROM bookings b JOIN rooms r ON r.id = b.room_id
       WHERE b.status = 'confirmed'
       ORDER BY b.check_in, r.number`
    )
    .all();
}

// Returns true if a confirmed booking was cancelled.
export function cancelBooking(id: number): boolean {
  const info = db
    .prepare("UPDATE bookings SET status = 'cancelled' WHERE id = ? AND status = 'confirmed'")
    .run(id);
  return info.changes > 0;
}
