const $ = (s) => document.querySelector(s);
const money = (n) => '₹' + Number(n).toLocaleString('en-IN');
const fmtDate = (d) => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
const esc = (s = '') => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const todayISO = () => new Date().toISOString().slice(0, 10);

async function api(path, method = 'GET', body) {
  const res = await fetch('/api' + path, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 204) return null;
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Something went wrong.');
  return data;
}

let msgTimer;
function notify(text, isError = false) {
  const el = $('#msg');
  el.textContent = text;
  el.className = isError ? 'error' : '';
  el.hidden = false;
  clearTimeout(msgTimer);
  msgTimer = setTimeout(() => (el.hidden = true), 4000);
}

/* ---------- form dialog ---------- */
function openForm(title, fields, onSubmit, submitLabel = 'Save') {
  $('#dlg-title').textContent = title;
  $('#save').textContent = submitLabel;
  $('#form-error').hidden = true;
  $('#fields').innerHTML = fields.map((f) => {
    const val = f.value ?? '';
    const attrs = `name="${f.name}" ${f.required ? 'required' : ''} ${f.min !== undefined ? `min="${f.min}"` : ''}`;
    const control = f.options
      ? `<select ${attrs}>${f.options.map((o) => {
          const [v, l] = Array.isArray(o) ? o : [o, o];
          return `<option value="${esc(v)}" ${String(v) === String(val) ? 'selected' : ''}>${esc(l)}</option>`;
        }).join('')}</select>`
      : `<input type="${f.type || 'text'}" ${attrs} value="${esc(val)}">`;
    return `<label>${esc(f.label)}${control}</label>`;
  }).join('');

  const form = $('#form');
  form.onsubmit = async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(form));
    try {
      const result = await onSubmit(data);
      if (result !== false) $('#dlg').close();
    } catch (err) {
      $('#form-error').textContent = err.message;
      $('#form-error').hidden = false;
    }
  };
  $('#dlg').showModal();
}
$('#cancel').onclick = () => $('#dlg').close();

const table = (heads, rows, emptyText) =>
  rows.length
    ? `<div class="panel"><table><thead><tr>${heads.map((h) => `<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.join('')}</tbody></table></div>`
    : `<div class="panel"><p class="empty">${emptyText}</p></div>`;

/* ---------- views ---------- */
const views = {
  async dashboard() {
    const [s, bookings] = await Promise.all([api('/stats'), api('/bookings')]);
    const t = todayISO();
    const arriving = bookings.filter((b) => b.status === 'booked' && b.checkIn.slice(0, 10) <= t);
    const leaving = bookings.filter((b) => b.status === 'checked-in' && b.checkOut.slice(0, 10) <= t);
    const inHouse = s.rooms - s.maintenance;
    $('#content').innerHTML = `
      <div class="stats">
        <div class="stat"><b>${s.occupied}/${inHouse}</b><span>Rooms occupied</span></div>
        <div class="stat"><b>${s.arrivals}</b><span>Arriving today</span></div>
        <div class="stat"><b>${s.departures}</b><span>Leaving today</span></div>
        <div class="stat"><b>${money(s.revenue)}</b><span>Revenue from completed stays</span></div>
      </div>
      <h3>Arrivals to check in</h3>
      ${table(['Guest', 'Room', 'Dates', ''], arriving.map((b) => bookingRow(b, true)), 'No arrivals waiting.')}
      <h3>Departures to check out</h3>
      ${table(['Guest', 'Room', 'Dates', ''], leaving.map((b) => bookingRow(b, true)), 'No one is due to leave.')}`;
  },

  async bookings() {
    $('#actions').innerHTML = '<button class="primary" id="add">New booking</button>';
    $('#add').onclick = newBooking;
    const list = await api('/bookings');
    $('#content').innerHTML = table(
      ['Guest', 'Room', 'Dates', 'Total', 'Status', ''],
      list.map((b) => bookingRow(b, false)),
      'No bookings yet. Create the first one.'
    );
  },

  async rooms() {
    $('#actions').innerHTML = '<button class="primary" id="add">Add room</button>';
    $('#add').onclick = () => roomForm();
    const list = await api('/rooms');
    window._rooms = list;
    $('#content').innerHTML = table(
      ['Room', 'Type', 'Floor', 'Sleeps', 'Per night', 'Amenities', 'Status', ''],
      list.map((r) => `<tr>
        <td><b>${esc(r.number)}</b></td><td>${r.type}</td><td>${r.floor}</td><td>${r.capacity}</td>
        <td>${money(r.pricePerNight)}</td><td>${esc(r.amenities.join(', '))}</td>
        <td><span class="tag ${r.status}">${r.status === 'active' ? 'In service' : 'Maintenance'}</span></td>
        <td><button class="link" data-edit="${r._id}">Edit</button><button class="link danger" data-del="${r._id}">Delete</button></td></tr>`),
      'No rooms yet. Add your first room.'
    );
    wire('[data-edit]', (id) => roomForm(window._rooms.find((r) => r._id === id)), 'edit');
    wire('[data-del]', (id) => remove('/rooms/' + id, 'Delete this room?', 'Room deleted.'), 'del');
  },

  async guests() {
    $('#actions').innerHTML = '<button class="primary" id="add">Add guest</button>';
    $('#add').onclick = () => guestForm();
    const list = await api('/guests');
    window._guests = list;
    $('#content').innerHTML = table(
      ['Name', 'Phone', 'Email', 'ID', ''],
      list.map((g) => `<tr><td><b>${esc(g.name)}</b></td><td>${esc(g.phone)}</td><td>${esc(g.email || '')}</td>
        <td>${esc(g.idType || '')} ${esc(g.idNumber || '')}</td>
        <td><button class="link" data-edit="${g._id}">Edit</button><button class="link danger" data-del="${g._id}">Delete</button></td></tr>`),
      'No guests yet. Add a guest to start a booking.'
    );
    wire('[data-edit]', (id) => guestForm(window._guests.find((g) => g._id === id)), 'edit');
    wire('[data-del]', (id) => remove('/guests/' + id, 'Delete this guest?', 'Guest deleted.'), 'del');
  },
};

function wire(selector, fn, attr) {
  document.querySelectorAll(selector).forEach((el) => (el.onclick = () => fn(el.dataset[attr])));
}

async function remove(path, question, done) {
  if (!confirm(question)) return;
  try { await api(path, 'DELETE'); notify(done); show(current); } catch (e) { notify(e.message, true); }
}

function bookingRow(b, compact) {
  const buttons = [];
  if (b.status === 'booked') buttons.push(`<button class="link" data-act="check-in" data-id="${b._id}">Check in</button>`,
                                          `<button class="link danger" data-act="cancel" data-id="${b._id}">Cancel</button>`);
  if (b.status === 'checked-in') buttons.push(`<button class="link" data-act="check-out" data-id="${b._id}">Check out</button>`);
  return `<tr>
    <td><b>${esc(b.guest?.name || 'Removed guest')}</b></td>
    <td>${esc(b.room?.number || '–')} · ${esc(b.room?.type || '')}</td>
    <td>${fmtDate(b.checkIn)} to ${fmtDate(b.checkOut)} (${b.nights} ${b.nights === 1 ? 'night' : 'nights'})</td>
    ${compact ? '' : `<td>${money(b.totalAmount)}</td><td><span class="tag ${b.status}">${b.status.replace('-', ' ')}</span></td>`}
    <td>${buttons.join('')}</td></tr>`;
}

document.addEventListener('click', async (e) => {
  const btn = e.target.closest('[data-act]');
  if (!btn) return;
  try {
    await api(`/bookings/${btn.dataset.id}/${btn.dataset.act}`, 'PATCH');
    notify('Booking updated.');
    show(current);
  } catch (err) { notify(err.message, true); }
});

/* ---------- forms ---------- */
function roomForm(r) {
  openForm(r ? `Edit room ${r.number}` : 'Add room', [
    { name: 'number', label: 'Room number', required: true, value: r?.number },
    { name: 'type', label: 'Type', options: ['Single', 'Double', 'Deluxe', 'Suite'], value: r?.type },
    { name: 'floor', label: 'Floor', type: 'number', min: 0, value: r?.floor ?? 1 },
    { name: 'capacity', label: 'Sleeps', type: 'number', min: 1, value: r?.capacity ?? 2 },
    { name: 'pricePerNight', label: 'Price per night (₹)', type: 'number', min: 0, required: true, value: r?.pricePerNight },
    { name: 'amenities', label: 'Amenities (comma separated)', value: r?.amenities.join(', ') },
    { name: 'status', label: 'Status', options: [['active', 'In service'], ['maintenance', 'Maintenance']], value: r?.status },
  ], async (d) => {
    d.amenities = d.amenities.split(',').map((a) => a.trim()).filter(Boolean);
    await api(r ? '/rooms/' + r._id : '/rooms', r ? 'PUT' : 'POST', d);
    notify(r ? 'Room updated.' : 'Room added.');
    show(current);
  });
}

function guestForm(g) {
  openForm(g ? `Edit ${g.name}` : 'Add guest', [
    { name: 'name', label: 'Full name', required: true, value: g?.name },
    { name: 'phone', label: 'Phone', required: true, value: g?.phone },
    { name: 'email', label: 'Email', type: 'email', value: g?.email },
    { name: 'idType', label: 'ID type', options: ['Aadhaar', 'Passport', 'Driving licence', 'Voter ID'], value: g?.idType },
    { name: 'idNumber', label: 'ID number', value: g?.idNumber },
    { name: 'address', label: 'Address', value: g?.address },
  ], async (d) => {
    await api(g ? '/guests/' + g._id : '/guests', g ? 'PUT' : 'POST', d);
    notify(g ? 'Guest updated.' : 'Guest added.');
    show(current);
  });
}

async function newBooking() {
  const guests = await api('/guests');
  if (!guests.length) return notify('Add a guest first, then create the booking.', true);
  const tomorrow = new Date(Date.now() + 864e5).toISOString().slice(0, 10);

  // Step 1: dates and guest. Step 2: rooms that are actually free for those dates.
  openForm('New booking', [
    { name: 'guest', label: 'Guest', options: guests.map((g) => [g._id, `${g.name} (${g.phone})`]) },
    { name: 'checkIn', label: 'Check-in', type: 'date', required: true, value: todayISO() },
    { name: 'checkOut', label: 'Check-out', type: 'date', required: true, value: tomorrow },
    { name: 'adults', label: 'Adults', type: 'number', min: 1, value: 1 },
  ], async (d) => {
    const free = await api(`/rooms/available?checkIn=${d.checkIn}&checkOut=${d.checkOut}`);
    const fit = free.filter((r) => r.capacity >= Number(d.adults));
    if (!fit.length) throw new Error('No rooms are free for those dates and guests.');
    $('#dlg').close();
    openForm('Choose a room', [
      { name: 'room', label: 'Available rooms', options: fit.map((r) => [r._id, `${r.number} · ${r.type} · ${money(r.pricePerNight)}/night`]) },
    ], async (r) => {
      await api('/bookings', 'POST', { ...d, room: r.room });
      notify('Booking created.');
      show(current);
    }, 'Book room');
    return false;  // the second dialog is already open; don't close it
  }, 'Find rooms');
}

/* ---------- navigation ---------- */
const titles = { dashboard: 'Today', bookings: 'Bookings', rooms: 'Rooms', guests: 'Guests' };
let current = 'dashboard';

async function show(view) {
  current = view;
  document.querySelectorAll('#nav button').forEach((b) => b.classList.toggle('on', b.dataset.view === view));
  $('#title').textContent = titles[view];
  $('#actions').innerHTML = '';
  try { await views[view](); } catch (e) { $('#content').innerHTML = `<p class="empty">${esc(e.message)}</p>`; }
}

$('#nav').onclick = (e) => e.target.dataset.view && show(e.target.dataset.view);
show('dashboard');
