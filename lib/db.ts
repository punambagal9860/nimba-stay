import Database from "better-sqlite3";

const db = new Database(process.env.DB_PATH ?? "nimba.db");
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
CREATE TABLE IF NOT EXISTS rooms (
  id INTEGER PRIMARY KEY,
  number TEXT UNIQUE NOT NULL,
  category TEXT NOT NULL,
  price_per_night INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'active'      -- 'active' | 'maintenance'
);
CREATE TABLE IF NOT EXISTS bookings (
  id INTEGER PRIMARY KEY,
  room_id INTEGER NOT NULL REFERENCES rooms(id),
  guest_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  check_in TEXT NOT NULL,                    -- 'YYYY-MM-DD'
  check_out TEXT NOT NULL,                   -- 'YYYY-MM-DD'
  total_price INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'confirmed'   -- 'confirmed' | 'cancelled'
);
CREATE INDEX IF NOT EXISTS idx_bookings_room_dates ON bookings(room_id, check_in, check_out);
`);

const { c } = db.prepare("SELECT COUNT(*) AS c FROM rooms").get() as { c: number };
if (c === 0) {
  const ins = db.prepare(
    "INSERT INTO rooms (number, category, price_per_night, status) VALUES (?,?,?,?)"
  );
  const seed: [string, string, number, string][] = [
    ["101", "standard", 2500, "active"],
    ["102", "standard", 2500, "active"],
    ["103", "standard", 2500, "maintenance"],
    ["201", "deluxe", 4000, "active"],
    ["202", "deluxe", 4000, "active"],
    ["301", "suite", 7000, "active"],
  ];
  seed.forEach((r) => ins.run(...r));
}

export default db;
