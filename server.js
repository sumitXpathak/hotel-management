require('dotenv').config();
const path = require('path');
const express = require('express');
const mongoose = require('mongoose');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/api/rooms', require('./routes/rooms'));
app.use('/api/guests', require('./routes/guests'));
app.use('/api/bookings', require('./routes/bookings'));
app.use('/api/stats', require('./routes/stats'));

// Central error handler
app.use((err, req, res, next) => {
  let status = err.status || 500;
  let message = err.message;
  if (err.name === 'ValidationError' || err.name === 'CastError') status = 400;
  if (err.code === 11000) {
    status = 409;
    message = `That ${Object.keys(err.keyPattern || {})[0] || 'value'} already exists.`;
  }
  if (status === 500) console.error(err);
  res.status(status).json({ error: message });
});

const PORT = process.env.PORT || 3000;
const URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/hotel_management';

mongoose
  .connect(URI)
  .then(() => {
    console.log('MongoDB connected');
    app.listen(PORT, () => console.log(`Hotel desk running at http://localhost:${PORT}`));
  })
  .catch((err) => {
    console.error('MongoDB connection failed:', err.message);
    process.exit(1);
  });
