# Hotel management system

Node.js, Express and MongoDB (Mongoose), with a plain HTML/CSS/JS front desk UI.

## Features
- Rooms: add, edit, delete, mark under maintenance
- Guests: add, edit, delete, search by name or phone
- Bookings: availability check by date, automatic total, check in, check out, cancel
- Today view: occupancy, arrivals, departures, revenue

## Run it
1. Install Node.js 18+ and MongoDB (local) or create a free MongoDB Atlas cluster.
2. Install packages: `npm install`
3. Copy `.env.example` to `.env` and set `MONGODB_URI`.
4. Optional sample data: `npm run seed`
5. Start: `npm start`, then open http://localhost:3000

## Structure
```
server.js        app + MongoDB connection
models/          Room, Guest, Booking schemas
routes/          REST API (rooms, guests, bookings, stats)
public/          front desk UI
seed.js          sample data
```

## API
| Method | Path | Purpose |
|---|---|---|
| GET/POST | /api/rooms | list / create |
| GET | /api/rooms/available?checkIn=&checkOut= | rooms free for dates |
| PUT/DELETE | /api/rooms/:id | update / delete |
| GET/POST | /api/guests | list (?q=search) / create |
| PUT/DELETE | /api/guests/:id | update / delete |
| GET/POST | /api/bookings | list / create |
| PATCH | /api/bookings/:id/check-in, check-out, cancel | status changes |
| GET | /api/stats | dashboard numbers |
