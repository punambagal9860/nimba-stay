import { describe, it, expect, beforeEach } from "vitest";
import db from "./db";
import {
  ClashError,
  createBooking,
  findFreeRooms,
  cancelBooking,
  isValidDate,
  nightsBetween,
} from "./availability";
import { GET as availabilityGET } from "../app/api/availability/route";
import { POST as bookingsPOST } from "../app/api/bookings/route";

// Seed (see lib/db.ts): 1=101 std, 2=102 std, 3=103 std MAINTENANCE, 4=201 dlx, 5=202 dlx, 6=301 suite
const MAINTENANCE_ID = 3;

const book = (room: number, ci: string, co: string) =>
  createBooking(room, "Test Guest", "9876543210", ci, co);
const freeIds = (ci: string, co: string, cat?: string) =>
  findFreeRooms(ci, co, cat).map((r) => r.id);

beforeEach(() => {
  db.exec("DELETE FROM bookings");
});

describe("clash rules", () => {
  it("guest leaving on 20 Nov does not block a guest arriving on 20 Nov", () => {
    book(1, "2026-11-18", "2026-11-20");
    expect(freeIds("2026-11-20", "2026-11-22")).toContain(1);
    expect(() => book(1, "2026-11-20", "2026-11-22")).not.toThrow();
  });

  it("overlapping stay is blocked", () => {
    book(1, "2026-11-18", "2026-11-20");
    expect(freeIds("2026-11-19", "2026-11-21")).not.toContain(1);
  });

  it("stay that ends on an existing check-in day is free", () => {
    book(1, "2026-11-18", "2026-11-20");
    expect(freeIds("2026-11-16", "2026-11-18")).toContain(1);
  });

  it("new stay fully inside an existing one is blocked", () => {
    book(1, "2026-11-10", "2026-11-20");
    expect(freeIds("2026-11-12", "2026-11-14")).not.toContain(1);
  });

  it("new stay that fully covers an existing one is blocked", () => {
    book(1, "2026-11-12", "2026-11-14");
    expect(freeIds("2026-11-10", "2026-11-20")).not.toContain(1);
  });

  it("cancelled booking blocks nothing", () => {
    const b = book(1, "2026-11-18", "2026-11-20");
    expect(cancelBooking(b.id)).toBe(true);
    expect(freeIds("2026-11-18", "2026-11-20")).toContain(1);
    expect(() => book(1, "2026-11-18", "2026-11-20")).not.toThrow();
  });

  it("maintenance room is never free and cannot be booked", () => {
    expect(freeIds("2026-12-01", "2026-12-03")).not.toContain(MAINTENANCE_ID);
    expect(() => book(MAINTENANCE_ID, "2026-12-01", "2026-12-03")).toThrow(ClashError);
  });

  it("booking the same room and dates twice throws ClashError", () => {
    book(1, "2026-11-18", "2026-11-20");
    expect(() => book(1, "2026-11-18", "2026-11-20")).toThrow(ClashError);
  });

  it("category filter and total price", () => {
    const rooms = findFreeRooms("2026-11-18", "2026-11-21", "deluxe");
    expect(rooms.map((r) => r.number)).toEqual(["201", "202"]);
    expect(rooms[0].nights).toBe(3);
    expect(rooms[0].totalPrice).toBe(12000);
  });
});

describe("date helpers", () => {
  it("validates dates", () => {
    expect(isValidDate("2026-11-20")).toBe(true);
    expect(isValidDate("2026-02-31")).toBe(false);
    expect(isValidDate("20-11-2026")).toBe(false);
  });
  it("counts nights", () => {
    expect(nightsBetween("2026-11-20", "2026-11-22")).toBe(2);
    expect(nightsBetween("2026-02-28", "2026-03-01")).toBe(1);
  });
});

describe("API", () => {
  const post = (body: unknown) =>
    bookingsPOST(
      new Request("http://x/api/bookings", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      })
    );
  const valid = {
    roomId: 1,
    guestName: "Asha",
    phone: "9876543210",
    checkIn: "2026-11-20",
    checkOut: "2026-11-22",
  };

  it("availability: checkout == checkin gives 400", async () => {
    const res = await availabilityGET(
      new Request("http://x/api/availability?checkIn=2026-11-20&checkOut=2026-11-20")
    );
    expect(res.status).toBe(400);
  });

  it("availability: returns rooms with total price", async () => {
    const res = await availabilityGET(
      new Request("http://x/api/availability?checkIn=2026-11-20&checkOut=2026-11-22&category=suite")
    );
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.rooms).toHaveLength(1);
    expect(data.rooms[0].totalPrice).toBe(14000);
  });

  it("bookings: checkout before checkin gives 400", async () => {
    expect((await post({ ...valid, checkIn: "2026-11-22", checkOut: "2026-11-20" })).status).toBe(400);
    expect((await post({ ...valid, checkOut: valid.checkIn })).status).toBe(400);
  });

  it("bookings: 9-digit and non-numeric phones give 400", async () => {
    expect((await post({ ...valid, phone: "123456789" })).status).toBe(400);
    expect((await post({ ...valid, phone: "98765abcde" })).status).toBe(400);
    expect((await post({ ...valid, phone: "+919876543210" })).status).toBe(400);
  });

  it("bookings: 201 then 409 on clash", async () => {
    expect((await post(valid)).status).toBe(201);
    expect((await post(valid)).status).toBe(409);
  });

  it("bookings: back-to-back booking is 201", async () => {
    expect((await post(valid)).status).toBe(201);
    expect((await post({ ...valid, checkIn: "2026-11-22", checkOut: "2026-11-24" })).status).toBe(201);
  });
});
