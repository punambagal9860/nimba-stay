"use client";
import { useEffect, useState } from "react";

type Room = { id: number; number: string; category: string; nights: number; totalPrice: number };
type Booking = {
  id: number;
  roomNumber: string;
  category: string;
  guestName: string;
  phone: string;
  checkIn: string;
  checkOut: string;
  totalPrice: number;
};

export default function Home() {
  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");
  const [category, setCategory] = useState("");
  const [rooms, setRooms] = useState<Room[] | null>(null);
  const [selected, setSelected] = useState<Room | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [bookings, setBookings] = useState<Booking[]>([]);

  async function loadBookings() {
    const res = await fetch("/api/bookings");
    if (res.ok) setBookings((await res.json()).bookings);
  }

  useEffect(() => {
    loadBookings();
  }, []);

  async function runSearch(): Promise<boolean> {
    const q = new URLSearchParams({ checkIn, checkOut, category });
    const res = await fetch(`/api/availability?${q}`);
    const data = await res.json();
    if (!res.ok) {
      setError(data.error);
      setRooms(null);
      return false;
    }
    setRooms(data.rooms);
    return true;
  }

  async function search() {
    setError("");
    setOk("");
    setSelected(null);
    await runSearch();
  }

  async function book() {
    if (!selected) return;
    setError("");
    setOk("");
    const res = await fetch("/api/bookings", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ roomId: selected.id, guestName: name, phone, checkIn, checkOut }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error);
      if (res.status === 409) {
        setSelected(null);
        await runSearch(); // someone just took it: refresh the list
        await loadBookings();
      }
      return;
    }
    setOk(`Booked room ${selected.number} for ${data.guestName}. Total ₹${data.totalPrice}.`);
    setName("");
    setPhone("");
    setSelected(null);
    await runSearch();
    await loadBookings();
  }

  async function cancel(id: number) {
    if (!confirm("Cancel this booking?")) return;
    setError("");
    setOk("");
    const res = await fetch(`/api/bookings/${id}`, { method: "PATCH" });
    const data = await res.json();
    if (!res.ok) setError(data.error);
    else setOk("Booking cancelled.");
    await loadBookings();
    if (checkIn && checkOut) await runSearch();
  }

  return (
    <main style={{ padding: 24, maxWidth: 760 }}>
      <h1>Nimba Stay</h1>

      <section>
        <h2>Find a room</h2>
        <label>
          Check-in <input type="date" value={checkIn} onChange={(e) => setCheckIn(e.target.value)} />
        </label>{" "}
        <label>
          Check-out{" "}
          <input type="date" value={checkOut} onChange={(e) => setCheckOut(e.target.value)} />
        </label>{" "}
        <select value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="">All categories</option>
          <option value="standard">Standard</option>
          <option value="deluxe">Deluxe</option>
          <option value="suite">Suite</option>
        </select>{" "}
        <button onClick={search}>Search</button>
      </section>

      {error && <p style={{ color: "red" }}>{error}</p>}
      {ok && <p style={{ color: "green" }}>{ok}</p>}

      {rooms && rooms.length === 0 && <p>No rooms free for these dates.</p>}
      {rooms && rooms.length > 0 && (
        <ul>
          {rooms.map((r) => (
            <li key={r.id}>
              Room {r.number} · {r.category} · {r.nights} night{r.nights > 1 ? "s" : ""} · ₹
              {r.totalPrice} <button onClick={() => setSelected(r)}>Select</button>
            </li>
          ))}
        </ul>
      )}

      {selected && (
        <section>
          <h3>
            Book room {selected.number} ({checkIn} to {checkOut}, ₹{selected.totalPrice})
          </h3>
          <input placeholder="Guest name" value={name} onChange={(e) => setName(e.target.value)} />{" "}
          <input
            placeholder="Phone (10 digits)"
            value={phone}
            inputMode="numeric"
            onChange={(e) => setPhone(e.target.value)}
          />{" "}
          <button onClick={book}>Book</button>
        </section>
      )}

      <section>
        <h2>Current bookings</h2>
        {bookings.length === 0 && <p>No bookings yet.</p>}
        <ul>
          {bookings.map((b) => (
            <li key={b.id}>
              Room {b.roomNumber} · {b.guestName} · {b.phone} · {b.checkIn} → {b.checkOut} · ₹
              {b.totalPrice} <button onClick={() => cancel(b.id)}>Cancel</button>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
