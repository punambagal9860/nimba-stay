# Nimba Stay

A small front-desk screen for Nimba Nature Cure: find free rooms for a stay, book a guest, cancel a booking.
Next.js (App Router) + TypeScript + SQLite (better-sqlite3).

## How to run

```bash
npm install
npm run dev        # http://localhost:3000
npm test           # clash-rule and API tests
```

Needs Node 20+. The database file `nimba.db` is created on first run and seeded with 6 rooms.
Delete it to reset.

## API

- `GET /api/availability?checkIn=YYYY-MM-DD&checkOut=YYYY-MM-DD&category=` returns the rooms free for the whole stay with `nights` and `totalPrice`. `category` is optional. Bad dates give 400.
- `POST /api/bookings` with `{ roomId, guestName, phone, checkIn, checkOut }`. Returns 201 on success, 400 for invalid input (check-out not after check-in, phone not exactly 10 digits, missing name), 409 on a clash.
- `GET /api/bookings` lists confirmed bookings (added, see below).
- `PATCH /api/bookings/:id` cancels a booking (added, see below).

## Clash rules (all in `lib/availability.ts`)

Two stays overlap when `existing.check_in < new.checkOut AND existing.check_out > new.checkIn`.

- Strict comparisons mean a guest leaving on 20 Nov does not block one arriving on 20 Nov.
- Bookings with status `cancelled` are ignored.
- Rooms with status `maintenance` are never free and cannot be booked.

No double booking: the availability check and the insert run inside one SQLite transaction started with
`BEGIN IMMEDIATE`, so two simultaneous requests cannot both pass the check. Dates are stored as plain
`YYYY-MM-DD` strings, so there are no timezone bugs.

## What works

- Availability search, booking, 400/409 handling, the three clash rules.
- One screen: dates + category, free rooms with total price, guest name + phone, book, errors shown on screen.
- After a booking or a 409 the room list refreshes, so stale results do not linger.
- 17 tests: clash rules, maintenance, cancelled, price, and API-level 400/409/201.

## What doesn't / assumptions

- No login. Anyone who can open the page can book and cancel.
- Phone must be exactly 10 digits, no `+91`, spaces or dashes (as the brief says).
- Price = nights × room's nightly rate. No guest-count or seasonal pricing.
- Seed data is invented: standard ₹2,500, deluxe ₹4,000, suite ₹7,000 per night; room 103 is in maintenance.
- Past check-in dates are allowed (the brief doesn't forbid them).
- Single timezone, single property. Rooms are not editable from the UI.
- Plain styling on purpose.

## Added by me

**Bookings list with a Cancel button** (`GET /api/bookings`, `PATCH /api/bookings/:id`).
The brief defines a "cancelled" status and a rule for it, but gives staff no way to cancel a booking, so
that rule could never be used at the front desk. Cancelling immediately frees the room in the next search.


## Tools


- I ran the app locally, tested booking, cancel and wrong-phone cases on the screen, and fixed a better-sqlite3 install error on Windows.
