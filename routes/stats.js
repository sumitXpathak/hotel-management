const router = require('express').Router();
const Room = require('../models/Room');
const Booking = require('../models/Booking');
const Guest = require('../models/Guest');
const { wrap } = require('../utils');

router.get('/', wrap(async (req, res) => {
  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);

  const [rooms, maintenance, guests, occupied, arrivals, departures, revenue] = await Promise.all([
    Room.countDocuments(),
    Room.countDocuments({ status: 'maintenance' }),
    Guest.countDocuments(),
    Booking.countDocuments({ status: 'checked-in' }),
    Booking.countDocuments({ status: 'booked', checkIn: { $gte: start, $lt: end } }),
    Booking.countDocuments({ status: 'checked-in', checkOut: { $gte: start, $lt: end } }),
    Booking.aggregate([
      { $match: { status: 'checked-out' } },
      { $group: { _id: null, total: { $sum: '$totalAmount' } } },
    ]),
  ]);

  res.json({ rooms, maintenance, guests, occupied, arrivals, departures, revenue: revenue[0]?.total || 0 });
}));

module.exports = router;
