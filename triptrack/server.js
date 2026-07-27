const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;
const DB = path.join(__dirname, 'data.json');
const BASE_URL = process.env.BASE_URL || 'https://triptrack-drifting-wave-3593.fly.dev';

function load() {
  if (!fs.existsSync(DB)) return { customers: [], trips: [], itinerary: [], notifications: [], messages: [], verifications: [] };
  const d = JSON.parse(fs.readFileSync(DB));
  if (!d.messages) d.messages = [];
  if (!d.verifications) d.verifications = [];
  return d;
}
function save(data) { fs.writeFileSync(DB, JSON.stringify(data, null, 2)); }
function genId(prefix) { return prefix + '_' + crypto.randomBytes(8).toString('hex'); }
function genToken() { return crypto.randomBytes(16).toString('hex'); }
function genCode() { return String(Math.floor(1000 + Math.random() * 9000)); }

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── API: Customers ──────────────────────────────────────────
app.get('/api/customers', (req, res) => {
  const d = load();
  const customers = d.customers.map(c => ({
    ...c,
    trip_count: d.trips.filter(t => t.customer_id === c.id).length
  }));
  res.json(customers);
});

app.post('/api/customers', (req, res) => {
  const { name, email, phone, passport } = req.body;
  if (!name || !email) return res.status(400).json({ error: 'name and email required' });
  const d = load();
  const c = { id: genId('cust'), name, email, phone: phone || '', passport: passport || '', token: genToken(), access_code: genCode(), created_at: new Date().toISOString() };
  d.customers.push(c);
  save(d);
  res.json({ id: c.id, token: c.token, name: c.name, email: c.email, access_code: c.access_code });
});

app.delete('/api/customers/:id', (req, res) => {
  const d = load();
  const tripIds = d.trips.filter(t => t.customer_id === req.params.id).map(t => t.id);
  d.itinerary = d.itinerary.filter(i => !tripIds.includes(i.trip_id));
  d.notifications = d.notifications.filter(n => !tripIds.includes(n.trip_id));
  d.trips = d.trips.filter(t => t.customer_id !== req.params.id);
  d.customers = d.customers.filter(c => c.id !== req.params.id);
  save(d);
  res.json({ ok: true });
});

// ── API: Trips ──────────────────────────────────────────────
app.get('/api/trips', (req, res) => {
  const d = load();
  const trips = d.trips.map(t => {
    const c = d.customers.find(c2 => c2.id === t.customer_id) || {};
    return { ...t, customer_name: c.name, customer_email: c.email, customer_token: c.token };
  });
  res.json(trips);
});

app.get('/api/trips/:id', (req, res) => {
  const d = load();
  const trip = d.trips.find(t => t.id === req.params.id);
  if (!trip) return res.status(404).json({ error: 'trip not found' });
  const c = d.customers.find(c2 => c2.id === trip.customer_id) || {};
  const items = d.itinerary.filter(i => i.trip_id === trip.id);
  const notifs = d.notifications.filter(n => n.trip_id === trip.id).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  res.json({ ...trip, customer_name: c.name, customer_email: c.email, customer_phone: c.phone, customer_token: c.token, itinerary: items, notifications: notifs });
});

app.post('/api/trips', (req, res) => {
  const { customer_id, title, destination, start_date, end_date, notes } = req.body;
  if (!customer_id || !title) return res.status(400).json({ error: 'customer_id and title required' });
  const d = load();
  const t = { id: genId('trip'), customer_id, title, destination: destination || '', start_date: start_date || '', end_date: end_date || '', status: 'upcoming', notes: notes || '', confirmed: false, created_at: new Date().toISOString() };
  d.trips.push(t);
  save(d);
  res.json({ id: t.id, title: t.title });
});

app.put('/api/trips/:id', (req, res) => {
  const d = load();
  const trip = d.trips.find(t => t.id === req.params.id);
  if (!trip) return res.status(404).json({ error: 'not found' });
  const { title, destination, start_date, end_date, status, notes, confirmed } = req.body;
  if (title) trip.title = title;
  if (destination) trip.destination = destination;
  if (start_date) trip.start_date = start_date;
  if (end_date) trip.end_date = end_date;
  if (status) trip.status = status;
  if (notes !== undefined) trip.notes = notes;
  if (confirmed !== undefined) trip.confirmed = confirmed;
  save(d);
  res.json({ ok: true });
});

app.delete('/api/trips/:id', (req, res) => {
  const d = load();
  d.itinerary = d.itinerary.filter(i => i.trip_id !== req.params.id);
  d.notifications = d.notifications.filter(n => n.trip_id !== req.params.id);
  d.trips = d.trips.filter(t => t.id !== req.params.id);
  save(d);
  res.json({ ok: true });
});

// ── API: Itinerary ──────────────────────────────────────────
app.post('/api/trips/:id/itinerary', (req, res) => {
  const { day_number, time, title, description, location, type } = req.body;
  if (!title) return res.status(400).json({ error: 'title required' });
  const d = load();
  const item = { id: genId('itin'), trip_id: req.params.id, day_number: day_number || 1, time: time || '', title, description: description || '', location: location || '', type: type || 'activity' };
  d.itinerary.push(item);
  save(d);
  res.json({ id: item.id });
});

app.delete('/api/itinerary/:id', (req, res) => {
  const d = load();
  d.itinerary = d.itinerary.filter(i => i.id !== req.params.id);
  save(d);
  res.json({ ok: true });
});

// ── API: Notifications (Admin sends to customer) ────────────
app.post('/api/trips/:id/notifications', (req, res) => {
  const { message, type } = req.body;
  if (!message) return res.status(400).json({ error: 'message required' });
  const d = load();
  const notif = { id: genId('notif'), trip_id: req.params.id, message, type: type || 'update', code: genCode(), read: false, created_at: new Date().toISOString() };
  d.notifications.push(notif);
  save(d);
  res.json({ id: notif.id, code: notif.code });
});

// ── Customer Portal ─────────────────────────────────────────
app.get('/portal/:token', (req, res) => {
  const d = load();
  const customer = d.customers.find(c => c.token === req.params.token);
  if (!customer) return res.status(404).send('Invalid link');
  const trips = d.trips.filter(t => t.customer_id === customer.id);
  res.send(portalHTML(customer, trips, req.params.token));
});

app.get('/portal/:token/trip/:tripId', (req, res) => {
  const d = load();
  const customer = d.customers.find(c => c.token === req.params.token);
  if (!customer) return res.status(404).send('Invalid link');
  const trip = d.trips.find(t => t.id === req.params.tripId && t.customer_id === customer.id);
  if (!trip) return res.status(404).send('Trip not found');
  const items = d.itinerary.filter(i => i.trip_id === trip.id);
  const notifs = d.notifications.filter(n => n.trip_id === trip.id).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  const msgs = d.messages.filter(m => m.trip_id === trip.id).sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  const verified = req.query.verified === '1';
  const error = req.query.error === '1';
  res.send(portalTripHTML(customer, trip, items, notifs, msgs, req.params.token, verified, error));
});

// ── Customer Verifies Email + Code for Discord/Telegram ──────
app.post('/portal/:token/trip/:tripId/verify', (req, res) => {
  const d = load();
  const customer = d.customers.find(c => c.token === req.params.token);
  if (!customer) return res.status(404).send('Invalid link');
  const trip = d.trips.find(t => t.id === req.params.tripId && t.customer_id === customer.id);
  if (!trip) return res.status(404).send('Trip not found');
  const { email, code } = req.body;
  if (email === customer.email && code === customer.access_code) {
    d.verifications.push({ id: genId('vrf'), customer_id: customer.id, trip_id: trip.id, verified_at: new Date().toISOString() });
    save(d);
    return res.redirect('/portal/' + req.params.token + '/trip/' + req.params.tripId + '?verified=1');
  }
  res.redirect('/portal/' + req.params.token + '/trip/' + req.params.tripId + '?error=1');
});

// ── Customer Sends a Support Message ────────────────────────
app.post('/portal/:token/trip/:tripId/message', (req, res) => {
  const d = load();
  const customer = d.customers.find(c => c.token === req.params.token);
  if (!customer) return res.status(404).send('Invalid link');
  const trip = d.trips.find(t => t.id === req.params.tripId && t.customer_id === customer.id);
  if (!trip) return res.status(404).send('Trip not found');
  const { message } = req.body;
  if (!message || !message.trim()) return res.redirect('/portal/' + req.params.token + '/trip/' + req.params.tripId + '?verified=1');
  const msg = { id: genId('msg'), trip_id: trip.id, customer_id: customer.id, customer_name: customer.name, message: message.trim(), created_at: new Date().toISOString() };
  d.messages.push(msg);
  save(d);
  res.redirect('/portal/' + req.params.token + '/trip/' + req.params.tripId + '?verified=1');
});

// ── API: Messages for a trip ────────────────────────────────
app.get('/api/trips/:id/messages', (req, res) => {
  const d = load();
  const msgs = d.messages.filter(m => m.trip_id === req.params.id).sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  res.json(msgs);
});

// ── Customer Self-Service: Fill Out Their Trip ──────────────
app.get('/portal/:token/trip/:tripId/edit', (req, res) => {
  const d = load();
  const customer = d.customers.find(c => c.token === req.params.token);
  if (!customer) return res.status(404).send('Invalid link');
  const trip = d.trips.find(t => t.id === req.params.tripId && t.customer_id === customer.id);
  if (!trip) return res.status(404).send('Trip not found');
  const items = d.itinerary.filter(i => i.trip_id === trip.id);
  res.send(portalEditHTML(customer, trip, items, req.params.token));
});

app.post('/portal/:token/trip/:tripId/itinerary', (req, res) => {
  const d = load();
  const customer = d.customers.find(c => c.token === req.params.token);
  if (!customer) return res.status(404).send('Invalid link');
  const trip = d.trips.find(t => t.id === req.params.tripId && t.customer_id === customer.id);
  if (!trip) return res.status(404).send('Trip not found');
  const { day_number, time, title, description, location, type } = req.body;
  if (!title) return res.status(400).send('Title required');
  const item = { id: genId('itin'), trip_id: trip.id, day_number: day_number || 1, time: time || '', title, description: description || '', location: location || '', type: type || 'activity' };
  d.itinerary.push(item);
  save(d);
  res.redirect('/portal/' + req.params.token + '/trip/' + req.params.tripId + '/edit');
});

app.post('/portal/:token/trip/:tripId/delete-itin/:itemId', (req, res) => {
  const d = load();
  d.itinerary = d.itinerary.filter(i => i.id !== req.params.itemId);
  save(d);
  res.redirect('/portal/' + req.params.token + '/trip/' + req.params.tripId + '/edit');
});

// ── Admin Dashboard ─────────────────────────────────────────
app.get('/', (req, res) => res.send(dashboardHTML()));
app.get('/admin', (req, res) => res.send(dashboardHTML()));

function esc(s) { return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

// ── HTML: Customer Portal (Trip List) ───────────────────────
function portalHTML(customer, trips, token) {
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>My Trips - Joel Journeys</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Segoe UI',sans-serif;background:#0a0f1a;color:#e0e0e0;min-height:100vh}
.topbar{background:linear-gradient(135deg,#0d2137,#1a3a5c);padding:20px 24px;text-align:center;border-bottom:2px solid #f0c040}
.topbar h1{color:#f0c040;font-size:22px;letter-spacing:2px}
.topbar p{color:#8ab4f8;font-size:14px;margin-top:4px}
.container{max-width:800px;margin:24px auto;padding:0 16px}
.welcome{font-size:18px;margin-bottom:20px;color:#ccc}
.trip-card{background:#111827;border:1px solid #1e3a5f;border-radius:12px;padding:20px;margin-bottom:16px;transition:border-color .2s;text-decoration:none;color:inherit;display:block}
.trip-card:hover{border-color:#f0c040}
.trip-card h3{color:#f0c040;font-size:18px;margin-bottom:8px}
.trip-meta{display:flex;gap:16px;font-size:13px;color:#8ab4f8;margin-bottom:8px;flex-wrap:wrap}
.trip-status{display:inline-block;padding:3px 10px;border-radius:12px;font-size:12px;font-weight:600}
.trip-status.upcoming{background:#1a3a5c;color:#4da6ff}
.trip-status.active{background:#1a3a1a;color:#4dff88}
.trip-status.completed{background:#3a1a3a;color:#ff8aff}
.confirmed-badge{background:#1a3a1a;color:#4dff88;padding:2px 8px;border-radius:8px;font-size:11px;margin-left:8px}
.no-trips{text-align:center;padding:40px;color:#666;font-size:16px}
</style></head><body>
<div class="topbar"><h1>JOEL JOURNEYS</h1><p>Your Travel Dashboard</p></div>
<div class="container">
<div class="welcome">Welcome, ${esc(customer.name)}!</div>
${trips.length === 0 ? '<div class="no-trips">No trips yet. Your travel concierge will add your first trip soon!</div>' :
trips.map(t => '<a href="/portal/' + token + '/trip/' + t.id + '" class="trip-card"><h3>' + esc(t.title) + (t.confirmed ? ' <span class="confirmed-badge">Confirmed</span>' : '') + '</h3><div class="trip-meta"><span>' + (esc(t.destination) || 'TBD') + '</span><span>' + (t.start_date || '?') + ' - ' + (t.end_date || '?') + '</span></div><span class="trip-status ' + t.status + '">' + t.status + '</span></a>').join('')}
</div></body></html>`;
}

// ── HTML: Customer Trip View (Confirmed) ────────────────────
function portalTripHTML(customer, trip, items, notifs, msgs, token, verified, error) {
  const grouped = {};
  items.forEach(i => { (grouped[i.day_number] = grouped[i.day_number] || []).push(i); });
  const icons = { flight: '\u2708\uFE0F', hotel: '\uD83C\uDFE8', activity: '\uD83C\uDFAF', restaurant: '\uD83C\uDF7D\uFE0F', transport: '\uD83D\uDE8C', note: '\uD83D\uDCDD' };
  const notifIcons = { update: '\uD83D\uDD14', delay: '\u23F3', alert: '\u26A0\uFE0F', cancel: '\u274C', change: '\uD83D\uDD04' };
  const locations = items.filter(i => i.location).map(i => i.location);
  const mapQuery = locations.length ? encodeURIComponent(trip.destination || locations[0]) : '';
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(trip.title)} - Joel Journeys</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Segoe UI',sans-serif;background:#0a0f1a;color:#e0e0e0;min-height:100vh}
.topbar{background:linear-gradient(135deg,#0d2137,#1a3a5c);padding:16px 24px;border-bottom:2px solid #f0c040;display:flex;align-items:center;justify-content:space-between}
.topbar h1{color:#f0c040;font-size:18px;letter-spacing:1px}
.topbar a{color:#8ab4f8;text-decoration:none;font-size:14px}
.container{max-width:800px;margin:20px auto;padding:0 16px}
.trip-header{margin-bottom:24px}
.trip-header h2{font-size:24px;color:#fff;margin-bottom:8px}
.trip-meta{display:flex;gap:16px;font-size:14px;color:#8ab4f8;flex-wrap:wrap}
.trip-status{display:inline-block;padding:3px 10px;border-radius:12px;font-size:12px;font-weight:600}
.trip-status.upcoming{background:#1a3a5c;color:#4da6ff}
.trip-status.active{background:#1a3a1a;color:#4dff88}
.trip-status.completed{background:#3a1a3a;color:#ff8aff}
.day-section{margin-bottom:24px}
.day-title{font-size:16px;color:#f0c040;border-bottom:1px solid #1e3a5f;padding-bottom:6px;margin-bottom:12px}
.tl{display:flex;gap:12px;padding:12px;background:#111827;border-radius:8px;margin-bottom:8px;border-left:3px solid #1e3a5f}
.tl .time{min-width:50px;color:#8ab4f8;font-size:13px;font-weight:600}
.tl .icon{font-size:20px;min-width:30px;text-align:center}
.tl .content h4{font-size:15px;color:#fff;margin-bottom:2px}
.tl .content p{font-size:13px;color:#aaa}
.tl .content .loc{font-size:12px;color:#4da6ff;margin-top:4px}
.section-title{color:#f0c040;font-size:18px;margin:28px 0 14px;border-bottom:1px solid #1e3a5f;padding-bottom:6px}
.map-section{margin-bottom:24px}
.map-frame{width:100%;height:350px;border:1px solid #1e3a5f;border-radius:12px}
.notif-item{background:#111827;border-left:3px solid #f0c040;border-radius:8px;padding:14px;margin-bottom:10px}
.notif-item.delay{border-left-color:#ff8844}
.notif-item.alert{border-left-color:#ff4d4d}
.notif-item.cancel{border-left-color:#ff4d4d}
.notif-item.change{border-left-color:#4da6ff}
.notif-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:6px}
.notif-type{font-size:12px;color:#8ab4f8;text-transform:uppercase;letter-spacing:1px}
.notif-time{font-size:11px;color:#666}
.notif-msg{font-size:14px;color:#e0e0e0;line-height:1.5}
.notif-code{font-size:11px;color:#f0c040;margin-top:6px;font-family:monospace}
.contact-bar{background:linear-gradient(135deg,#0d2137,#1a3a5c);border:1px solid #1e3a5f;border-radius:12px;padding:20px;margin-top:30px;text-align:center}
.contact-bar h3{color:#f0c040;font-size:16px;margin-bottom:12px}
.contact-bar p{color:#8ab4f8;font-size:13px;margin-bottom:16px}
.contact-links{display:flex;gap:12px;justify-content:center;flex-wrap:wrap}
.contact-links a{background:#f0c040;color:#0a0f1a;text-decoration:none;padding:10px 20px;border-radius:50px;font-size:13px;font-weight:700;transition:background .2s}
.contact-links a:hover{background:#ffe066}
.verified-bar{background:linear-gradient(135deg,#1a3a1a,#0d2137);border:1px solid #4dff88;border-radius:12px;padding:20px;margin-top:16px;text-align:center}
.verified-bar h3{color:#4dff88;font-size:16px;margin-bottom:8px}
.verified-bar p{color:#8ab4f8;font-size:13px;margin-bottom:16px}
.verify-bar{background:linear-gradient(135deg,#0d2137,#1a3a5c);border:1px solid #1e3a5f;border-radius:12px;padding:20px;margin-top:16px;text-align:center}
.verify-bar h3{color:#f0c040;font-size:16px;margin-bottom:8px}
.verify-bar p{color:#8ab4f8;font-size:13px;margin-bottom:16px}
.verify-form{display:flex;gap:8px;justify-content:center;flex-wrap:wrap}
.verify-form input{background:#0a0f1a;color:#e0e0e0;border:1px solid #1e3a5f;border-radius:8px;padding:10px 14px;font-size:14px;outline:none;font-family:inherit}
.verify-form input:focus{border-color:#f0c040}
.verify-form input[type="email"]{width:220px}
.verify-form input[type="text"]{width:100px;text-align:center;font-size:18px;font-weight:700;font-family:monospace;letter-spacing:4px}
.verify-error{color:#ff4d4d;font-size:13px;margin-bottom:12px}
.chat-section{margin-top:24px}
.chat-thread{background:#111827;border:1px solid #1e3a5f;border-radius:12px;padding:16px;max-height:400px;overflow-y:auto;margin-bottom:12px}
.chat-msg{margin-bottom:12px;padding:10px 14px;border-radius:10px;max-width:85%}
.chat-msg.customer{background:#1a3a5c;margin-left:auto;border-bottom-right-radius:2px}
.chat-msg.admin{background:#1a3a1a;border-bottom-left-radius:2px}
.chat-meta{display:flex;justify-content:space-between;margin-bottom:4px}
.chat-sender{font-size:12px;font-weight:600;color:#f0c040}
.chat-time{font-size:11px;color:#666}
.chat-text{font-size:14px;color:#e0e0e0;line-height:1.5}
.chat-empty{text-align:center;color:#666;font-size:13px;padding:20px}
.chat-form{display:flex;gap:8px}
.chat-form input{flex:1;background:#0a0f1a;color:#e0e0e0;border:1px solid #1e3a5f;border-radius:8px;padding:12px 16px;font-size:14px;outline:none;font-family:inherit}
.chat-form input:focus{border-color:#f0c040}
.chat-form .btn{width:auto;padding:12px 24px;margin-top:0}
.no-content{text-align:center;padding:30px;color:#666}
</style></head><body>
<div class="topbar"><h1>${esc(trip.title)}</h1><div><a href="/portal/${token}">My Trips</a></div></div>
<div class="container">
<div class="trip-header">
  <h2>${esc(trip.title)}</h2>
  <div class="trip-meta">
    <span>${esc(trip.destination) || 'Destination TBD'}</span>
    <span>${trip.start_date || '?'} - ${trip.end_date || '?'}</span>
    <span class="trip-status ${trip.status}">${trip.status}</span>
  </div>
  ${trip.notes ? '<p style="margin-top:8px;color:#aaa;font-size:14px">' + esc(trip.notes) + '</p>' : ''}
</div>

${notifs.length > 0 ? '<h2 class="section-title">Updates & Info</h2>' + notifs.map(n => '<div class="notif-item ' + n.type + '"><div class="notif-header"><span class="notif-type">' + (notifIcons[n.type] || '\uD83D\uDD14') + ' ' + esc(n.type) + '</span><span class="notif-time">' + new Date(n.created_at).toLocaleDateString() + ' ' + new Date(n.created_at).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}) + '</span></div><div class="notif-msg">' + esc(n.message) + '</div><div class="notif-code">Reference: #' + n.code + '</div></div>').join('') : ''}

${mapQuery ? '<h2 class="section-title">Your Destination</h2><div class="map-section"><iframe class="map-frame" src="https://www.google.com/maps?q=' + mapQuery + '&z=12&output=embed&hl=en" allowfullscreen loading="lazy"></iframe></div>' : ''}

${Object.keys(grouped).length > 0 ? '<h2 class="section-title">Your Itinerary</h2>' + Object.entries(grouped).map(([day, events]) => '<div class="day-section"><div class="day-title">Day ' + day + '</div>' + events.map(e => '<div class="tl"><div class="time">' + esc(e.time) + '</div><div class="icon">' + (icons[e.type] || '\uD83D\uDCCC') + '</div><div class="content"><h4>' + esc(e.title) + '</h4><p>' + esc(e.description) + '</p>' + (e.location ? '<div class="loc">\uD83D\uDCCD ' + esc(e.location) + '</div>' : '') + '</div></div>').join('') + '</div>').join('') : '<div class="no-content">No itinerary items yet</div>'}

<div class="contact-bar">
  <h3>Need Assistance?</h3>
  <p>Your travel concierge is available 24/7</p>
  <div class="contact-links">
    <a href="mailto:concierge@joeljourneys.com">Email</a>
  </div>
</div>

${verified ? `
<div class="verified-bar">
  <h3>You're Connected!</h3>
  <p>Join our Discord for real-time updates and chat with your concierge, or message below</p>
  <div class="contact-links">
    <a href="https://discord.gg/joeljourneys" target="_blank">Join Discord</a>
  </div>
</div>
<div class="chat-section">
  <h2 class="section-title">Messages</h2>
  <div class="chat-thread">
    ${msgs.length > 0 ? msgs.map(m => {
      const isAdmin = m.from_admin;
      return '<div class="chat-msg ' + (isAdmin ? 'admin' : 'customer') + '"><div class="chat-meta"><span class="chat-sender">' + esc(isAdmin ? 'Concierge' : customer.name) + '</span><span class="chat-time">' + new Date(m.created_at).toLocaleString([], {hour:'2-digit',minute:'2-digit',month:'short',day:'numeric'}) + '</span></div><div class="chat-text">' + esc(m.message) + '</div></div>';
    }).join('') : '<div class="chat-empty">No messages yet. Send a message to your concierge below.</div>'}
  </div>
  <form method="POST" action="/portal/${token}/trip/${trip.id}/message" class="chat-form">
    <input type="text" name="message" placeholder="Type your message..." required autocomplete="off">
    <button type="submit" class="btn">Send</button>
  </form>
</div>
` : `
<div class="verify-bar">
  <h3>Sign In for More</h3>
  <p>Enter your email and access code to unlock Discord & Telegram integration</p>
  ${error ? '<div class="verify-error">Invalid email or code. Please check with your travel concierge.</div>' : ''}
  <form method="POST" action="/portal/${token}/trip/${trip.id}/verify" class="verify-form">
    <input type="email" name="email" placeholder="Your email" required value="${esc(customer.email)}">
    <input type="text" name="code" placeholder="4-digit code" maxlength="4" pattern="[0-9]{4}" inputmode="numeric" required>
    <button type="submit" class="btn">Sign In</button>
  </form>
</div>
`}
</div></body></html>`;
}

// ── HTML: Customer Self-Service Edit Page ───────────────────
function portalEditHTML(customer, trip, items, token) {
  const grouped = {};
  items.forEach(i => { (grouped[i.day_number] = grouped[i.day_number] || []).push(i); });
  const icons = { flight: '\u2708\uFE0F', hotel: '\uD83C\uDFE8', activity: '\uD83C\uDFAF', restaurant: '\uD83C\uDF7D\uFE0F', transport: '\uD83D\uDE8C', note: '\uD83D\uDCDD' };
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Plan Your Trip - Joel Journeys</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Segoe UI',sans-serif;background:#0a0f1a;color:#e0e0e0;min-height:100vh}
.topbar{background:linear-gradient(135deg,#0d2137,#1a3a5c);padding:16px 24px;border-bottom:2px solid #f0c040;display:flex;align-items:center;justify-content:space-between}
.topbar h1{color:#f0c040;font-size:18px;letter-spacing:1px}
.topbar a{color:#8ab4f8;text-decoration:none;font-size:14px}
.container{max-width:800px;margin:20px auto;padding:0 16px}
h2{color:#fff;font-size:22px;margin-bottom:16px}
h3{color:#f0c040;font-size:16px;margin:20px 0 12px;border-bottom:1px solid #1e3a5f;padding-bottom:6px}
.info-bar{display:flex;gap:16px;font-size:14px;color:#8ab4f8;margin-bottom:20px;flex-wrap:wrap}
.form-card{background:#111827;border:1px solid #1e3a5f;border-radius:12px;padding:20px;margin-bottom:16px}
.form-card label{display:block;color:#8ab4f8;font-size:13px;margin-bottom:4px;margin-top:10px}
.form-card input,.form-card select,.form-card textarea{width:100%;background:#0a0f1a;color:#e0e0e0;border:1px solid #1e3a5f;border-radius:8px;padding:10px 14px;font-size:14px;outline:none;font-family:inherit}
.form-card input:focus,.form-card select:focus,.form-card textarea:focus{border-color:#f0c040}
.row{display:flex;gap:12px}
.row>*{flex:1}
.btn{background:#f0c040;color:#0a0f1a;border:none;border-radius:8px;padding:12px 24px;font-size:14px;font-weight:700;cursor:pointer;width:100%;margin-top:16px;transition:background .2s}
.btn:hover{background:#ffe066}
.btn.danger{background:#ff4d4d;color:#fff}
.btn.small{padding:6px 12px;font-size:12px;width:auto;margin-top:0}
.itin-item{background:#0a0f1a;border:1px solid #1e3a5f;border-radius:8px;padding:12px;margin-bottom:8px;display:flex;align-items:center;gap:12px}
.itin-item .time{color:#8ab4f8;font-size:13px;min-width:50px;font-weight:600}
.itin-item .icon{font-size:18px}
.itin-item .info{flex:1}
.itin-item .info h4{font-size:14px;color:#fff}
.itin-item .info p{font-size:12px;color:#aaa}
.itin-item .info .loc{font-size:11px;color:#4da6ff}
.day-header{color:#f0c040;font-weight:600;font-size:15px;margin:16px 0 8px}
.tip{background:#1a3a5c;border-radius:8px;padding:12px;font-size:13px;color:#8ab4f8;margin-bottom:16px}
.tip strong{color:#f0c040}
.done-bar{background:#1a3a1a;border:1px solid #4dff88;border-radius:12px;padding:20px;margin-top:24px;text-align:center}
.done-bar h3{color:#4dff88;font-size:16px;margin-bottom:8px}
.done-bar p{color:#8ab4f8;font-size:13px;margin-bottom:12px}
</style></head><body>
<div class="topbar">
  <h1>Plan: ${esc(trip.title)}</h1>
  <div><a href="/portal/${token}/trip/${trip.id}" style="margin-right:16px">View Trip</a><a href="/portal/${token}">My Trips</a></div>
</div>
<div class="container">
<h2>Build Your Itinerary</h2>
<div class="info-bar">
  <span>${esc(trip.destination) || 'Destination TBD'}</span>
  <span>${trip.start_date || '?'} - ${trip.end_date || '?'}</span>
</div>
<div class="tip"><strong>Tip:</strong> Add your planned activities, flights, hotel check-ins, and restaurant reservations below. Organize by day and time. When you're done, go to your trip page and enter your email + access code to unlock Discord & Telegram integration.</div>

<div class="form-card">
<h3>Add Activity</h3>
<form method="POST" action="/portal/${token}/trip/${trip.id}/itinerary">
  <div class="row">
    <div><label>Day Number</label><input type="number" name="day_number" value="1" min="1" max="30" required></div>
    <div><label>Time</label><input type="text" name="time" placeholder="e.g. 09:00"></div>
  </div>
  <label>Activity Name *</label>
  <input type="text" name="title" placeholder="e.g. Visit Chichen Itza" required>
  <div class="row">
    <div><label>Type</label>
      <select name="type">
        <option value="activity">Activity / Tour</option>
        <option value="flight">Flight</option>
        <option value="hotel">Hotel</option>
        <option value="restaurant">Restaurant</option>
        <option value="transport">Transport</option>
        <option value="note">Note</option>
      </select>
    </div>
    <div><label>Location</label><input type="text" name="location" placeholder="e.g. Cancun Hotel Zone"></div>
  </div>
  <label>Description</label>
  <textarea name="description" rows="2" placeholder="Details, confirmation numbers, notes..."></textarea>
  <button type="submit" class="btn">Add to Itinerary</button>
</form>
</div>

${items.length > 0 ? '<h3>Your Itinerary</h3>' + Object.entries(grouped).map(([day, events]) => '<div class="day-header">Day ' + day + '</div>' + events.map(e => '<div class="itin-item"><div class="time">' + esc(e.time) + '</div><div class="icon">' + (icons[e.type] || '\uD83D\uDCCC') + '</div><div class="info"><h4>' + esc(e.title) + '</h4><p>' + esc(e.description) + '</p>' + (e.location ? '<div class="loc">' + esc(e.location) + '</div>' : '') + '</div><form method="POST" action="/portal/' + token + '/trip/' + trip.id + '/delete-itin/' + e.id + '" style="margin:0"><button type="submit" class="btn small danger" onclick="return confirm(\'Delete this item?\')">X</button></form></div>').join('')).join('') : ''}

${items.length > 0 ? '<div class="done-bar"><h3>Done Planning?</h3><p>Head to your trip page and enter your email + access code to unlock Discord & Telegram.</p><a href="/portal/' + token + '/trip/' + trip.id + '" style="color:#4dff88;font-size:14px;text-decoration:none;font-weight:700">Go to My Trip &rarr;</a></div>' : ''}

<div style="text-align:center;margin:30px 0"><a href="/portal/${token}/trip/${trip.id}" style="color:#f0c040;font-size:16px;text-decoration:none">View My Trip &rarr;</a></div>
</div></body></html>`;
}

// ── HTML: Admin Dashboard ───────────────────────────────────
function dashboardHTML() {
  return '<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">\
<title>TripTrack - Admin</title>\
<style>\
*{margin:0;padding:0;box-sizing:border-box}\
body{font-family:Segoe UI,sans-serif;background:#0a0f1a;color:#e0e0e0;min-height:100vh}\
.topbar{background:linear-gradient(135deg,#0d2137,#1a3a5c);padding:20px 24px;border-bottom:2px solid #f0c040;display:flex;align-items:center;justify-content:space-between}\
.topbar h1{color:#f0c040;font-size:22px;letter-spacing:2px}\
.topbar span{color:#8ab4f8;font-size:13px}\
.welcome{padding:20px 24px 0;max-width:1100px;margin:0 auto;font-size:18px;color:#ccc}\
.welcome span{color:#f0c040}\
.tabs{display:flex;background:#111827;border-bottom:1px solid #1e3a5f;margin-top:16px}\
.tab{padding:12px 24px;cursor:pointer;color:#8ab4f8;border-bottom:2px solid transparent;font-size:14px;transition:all .2s}\
.tab:hover{color:#fff}\
.tab.active{color:#f0c040;border-bottom-color:#f0c040}\
.container{max-width:1100px;margin:20px auto;padding:0 16px}\
.panel{display:none}.panel.active{display:block}\
.btn{background:#f0c040;color:#0a0f1a;border:none;border-radius:8px;padding:10px 20px;font-size:14px;font-weight:700;cursor:pointer;transition:background .2s}\
.btn:hover{background:#ffe066}\
.btn.danger{background:#ff4d4d;color:#fff}\
.btn.small{padding:6px 12px;font-size:12px}\
.btn.secondary{background:#1e3a5f;color:#8ab4f8}\
.btn.secondary:hover{background:#2a5080}\
.card{background:#111827;border:1px solid #1e3a5f;border-radius:12px;padding:20px;margin-bottom:16px}\
.card h3{color:#f0c040;font-size:16px;margin-bottom:12px}\
.card-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:16px}\
.field{margin-bottom:10px}\
.field label{display:block;color:#8ab4f8;font-size:12px;margin-bottom:4px;text-transform:uppercase;letter-spacing:1px}\
.field input,.field select,.field textarea{width:100%;background:#0a0f1a;color:#e0e0e0;border:1px solid #1e3a5f;border-radius:8px;padding:10px 14px;font-size:14px;outline:none;font-family:inherit}\
.field input:focus,.field select:focus,.field textarea:focus{border-color:#f0c040}\
.row2{display:flex;gap:12px}.row2>*{flex:1}\
.badge{display:inline-block;padding:3px 10px;border-radius:10px;font-size:11px;font-weight:600}\
.badge.upcoming{background:#1a3a5c;color:#4da6ff}\
.badge.active{background:#1a3a1a;color:#4dff88}\
.badge.completed{background:#3a1a3a;color:#ff8aff}\
.badge.confirmed{background:#1a3a1a;color:#4dff88}\
.badge.unconfirmed{background:#3a2a0a;color:#f0c040}\
.customer-card{position:relative}\
.customer-card .name{font-size:18px;font-weight:700;color:#fff;margin-bottom:6px}\
.customer-card .email{font-size:13px;color:#8ab4f8}\
.customer-card .phone{font-size:13px;color:#aaa}\
.customer-card .code{font-family:monospace;color:#f0c040;font-weight:700;font-size:20px;letter-spacing:3px;margin:8px 0}\
.customer-card .actions{display:flex;gap:8px;margin-top:12px}\
.trip-card{position:relative}\
.trip-card .title{font-size:16px;font-weight:700;color:#fff}\
.trip-card .meta{font-size:13px;color:#8ab4f8;margin:6px 0}\
.trip-card .actions{display:flex;gap:8px;margin-top:12px;flex-wrap:wrap}\
.empty{text-align:center;padding:40px;color:#555;font-size:15px}\
.stats{display:flex;gap:16px;margin-bottom:24px}\
.stat-card{background:#111827;border:1px solid #1e3a5f;border-radius:10px;padding:16px 24px;text-align:center;flex:1}\
.stat-card .num{font-size:28px;color:#f0c040;font-weight:700}\
.stat-card .label{font-size:12px;color:#8ab4f8;margin-top:4px}\
.slide{max-height:0;overflow:hidden;transition:max-height .3s ease}\
.slide.open{max-height:2000px}\
.greeting{background:linear-gradient(135deg,#0d2137,#1a3a5c);border:1px solid #1e3a5f;border-radius:12px;padding:24px;margin-bottom:24px;text-align:center}\
.greeting h2{color:#f0c040;font-size:20px;margin-bottom:8px}\
.greeting p{color:#8ab4f8;font-size:14px}\
.itin-item{display:flex;gap:8px;align-items:center;padding:10px;background:#0a0f1a;border-radius:6px;margin-bottom:6px;font-size:13px;border-left:3px solid #1e3a5f}\
.itin-item .time{color:#8ab4f8;min-width:50px;font-weight:600}\
.itin-item .info{flex:1;color:#e0e0e0}\
.itin-item .type{color:#666;font-size:11px}\
.notif-item{padding:12px;border-left:3px solid #f0c040;border-radius:6px;margin-bottom:8px;background:#0a0f1a;font-size:13px}\
.notif-item.delay{border-left-color:#ff8844}\
.notif-item.alert,.notif-item.cancel{border-left-color:#ff4d4d}\
.modal{display:none;position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,.7);z-index:100;align-items:center;justify-content:center}\
.modal.show{display:flex}\
.modal-box{background:#111827;border:1px solid #1e3a5f;border-radius:12px;padding:24px;width:90%;max-width:700px;max-height:85vh;overflow-y:auto}\
.modal-box h3{color:#f0c040;margin-bottom:16px}\
.close{float:right;background:none;border:none;color:#8ab4f8;font-size:28px;cursor:pointer;line-height:1}\
.close:hover{color:#fff}\
.mform .field{margin-bottom:10px}\
.mform .field label{display:block;color:#8ab4f8;font-size:12px;margin-bottom:4px}\
.mform .field input,.mform .field select,.mform .field textarea{width:100%;background:#0a0f1a;color:#e0e0e0;border:1px solid #1e3a5f;border-radius:8px;padding:10px 14px;font-size:14px;outline:none;font-family:inherit}\
.mform .field input:focus,.mform .field select:focus,.mform .field textarea:focus{border-color:#f0c040}\
</style></head><body>\
<div class="topbar"><h1>TRIPTRACK</h1><span>Joel Journeys Admin</span></div>\
<div class="tabs" id="tabs">\
  <div class="tab active" data-tab="home">Home</div>\
  <div class="tab" data-tab="customers">People</div>\
  <div class="tab" data-tab="trips">Trips</div>\
</div>\
<div class="container">\
<div id="home" class="panel active">\
  <div class="greeting">\
    <h2>Hey! Welcome back.</h2>\
    <p>Here is a quick look at what is going on with your travelers.</p>\
  </div>\
  <div class="stats"><div class="stat-card"><div class="num" id="sCust">0</div><div class="label">People</div></div>\
  <div class="stat-card"><div class="num" id="sTrips">0</div><div class="label">Trips</div></div>\
  <div class="stat-card"><div class="num" id="sConfirmed">0</div><div class="label">Confirmed</div></div>\
  <div class="stat-card"><div class="num" id="sActive">0</div><div class="label">Active</div></div></div>\
  <h3 style="color:#8ab4f8;margin-bottom:12px">Recent Activity</h3>\
  <div id="recentTrips"></div>\
</div>\
<div id="customers" class="panel">\
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">\
    <h2 style="color:#fff">People</h2><button class="btn" data-act="addCustomer">+ New Person</button>\
  </div>\
  <div id="customerGrid" class="card-grid"><div class="empty">No one yet. Add your first traveler above!</div></div>\
</div>\
<div id="trips" class="panel">\
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">\
    <h2 style="color:#fff">Trips</h2><button class="btn" data-act="addTrip">+ New Trip</button>\
  </div>\
  <div id="tripGrid" class="card-grid"><div class="empty">No trips yet. Time to get someone booked!</div></div>\
</div>\
</div>\
<div class="modal" id="modal"><div class="modal-box"><button class="close" data-act="closeModal">&times;</button><div id="modalBody"></div></div></div>\
<script>\
var customers=[],trips=[],currentTripId="",currentToken="";\
function api(u,o){return fetch(u,Object.assign({headers:{"Content-Type":"application/json"}},o||{})).then(function(r){return r.json()}).catch(function(e){alert("Connection error. Try again.");return {}})}\
function $(id){return document.getElementById(id)}\
function esc(s){return String(s||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")}\
function showTab(id){document.querySelectorAll(".panel").forEach(function(p){p.classList.remove("active")});document.querySelectorAll(".tab").forEach(function(t){t.classList.remove("active")});$(id).classList.add("active");document.querySelector("[data-tab="+id+"]").classList.add("active");if(id==="customers")loadCustomers();if(id==="trips")loadTrips();if(id==="home")loadDashboard()}\
\
$("tabs").addEventListener("click",function(e){var t=e.target.closest("[data-tab]");if(t)showTab(t.dataset.tab)});\
\
document.addEventListener("click",function(e){\
  var b=e.target.closest("[data-act]");\
  if(!b)return;\
  var a=b.dataset.act,id=b.dataset.id,token=b.dataset.token,status=b.dataset.status,tripId=b.dataset.tripid,itinId=b.dataset.itinid;\
  if(a==="addCustomer")showAddCustomer();\
  else if(a==="addTrip")showAddTrip();\
  else if(a==="closeModal")$("modal").classList.remove("show");\
  else if(a==="saveCustomer")doAddCustomer();\
  else if(a==="saveTrip")doAddTrip();\
  else if(a==="copyLink")copyLink(token);\
  else if(a==="delCustomer")doDelCustomer(id);\
  else if(a==="delTrip")doDelTrip(id);\
  else if(a==="toggleStatus")doToggleStatus(id,status);\
  else if(a==="openTrip")doOpenTrip(id);\
  else if(a==="saveItin")doAddItinItem();\
  else if(a==="delItin")doDelItin(itinId,tripId);\
  else if(a==="sendUpdate")doSendNotif();\
});\
\
async function loadCustomers(){\
  var data=await api("/api/customers");\
  customers=Array.isArray(data)?data:[];\
  var g=$("customerGrid");\
  if(!customers.length){g.innerHTML="<div class=\\"empty\\">No one yet. Add your first traveler above!</div>";return;}\
  g.innerHTML=customers.map(function(c){\
    return "<div class=\\"card customer-card\\">\
      <div class=\\"name\\">"+esc(c.name)+"</div>\
      <div class=\\"email\\">"+esc(c.email)+"</div>\
      "+(c.phone?"<div class=\\"phone\\">"+esc(c.phone)+"</div>":"")+"\
      <div class=\\"code\\">"+(c.access_code||"—")+"</div>\
      <div style=\\"font-size:12px;color:#666\\">access code</div>\
      <div class=\\"actions\\">\
        <button class=\\"btn small\\" data-act=\\"copyLink\\" data-token=\\""+esc(c.token)+"\\">Copy Link</button>\
        <a href=\\"/portal/"+esc(c.token)+"\\" target=\\"_blank\\" class=\\"btn small secondary\\" style=\\"text-decoration:none\\">Open Portal</a>\
        <button class=\\"btn small danger\\" data-act=\\"delCustomer\\" data-id=\\""+esc(c.id)+"\\">Delete</button>\
      </div>\
    </div>";\
  }).join("");\
}\
\
async function loadTrips(){\
  var data=await api("/api/trips");\
  trips=Array.isArray(data)?data:[];\
  var g=$("tripGrid");\
  if(!trips.length){g.innerHTML="<div class=\\"empty\\">No trips yet. Time to get someone booked!</div>";return;}\
  g.innerHTML=trips.map(function(t){\
    return "<div class=\\"card trip-card\\">\
      <div class=\\"title\\">"+esc(t.title)+"</div>\
      <div class=\\"meta\\">"+esc(t.customer_name)+" &middot; "+esc(t.destination||"TBD")+"</div>\
      <div class=\\"meta\\">"+(t.start_date||"?")+" - "+(t.end_date||"?")+"</div>\
      <div>\
        <span class=\\"badge "+t.status+"\\">"+t.status+"</span>\
        "+(t.confirmed?"<span class=\\"badge confirmed\\">confirmed</span>":"<span class=\\"badge unconfirmed\\">not confirmed</span>")+"\
      </div>\
      <div class=\\"actions\\">\
        <button class=\\"btn small secondary\\" data-act=\\"openTrip\\" data-id=\\""+esc(t.id)+"\\">Details</button>\
        <button class=\\"btn small\\" data-act=\\"toggleStatus\\" data-id=\\""+esc(t.id)+"\\" data-status=\\""+esc(t.status)+"\\">Cycle Status</button>\
        <button class=\\"btn small danger\\" data-act=\\"delTrip\\" data-id=\\""+esc(t.id)+"\\">Delete</button>\
      </div>\
    </div>";\
  }).join("");\
}\
\
async function loadDashboard(){\
  await loadCustomers();\
  await loadTrips();\
  $("sCust").textContent=customers.length;\
  $("sTrips").textContent=trips.length;\
  $("sConfirmed").textContent=trips.filter(function(t){return t.confirmed}).length;\
  $("sActive").textContent=trips.filter(function(t){return t.status==="active"}).length;\
  var recent=trips.slice(0,5);\
  $("recentTrips").innerHTML=recent.length?recent.map(function(t){\
    return "<div class=\\"card\\" style=\\"padding:14px\\"><strong>"+esc(t.title)+"</strong> <span style=\\"color:#8ab4f8;font-size:13px\\">- "+esc(t.customer_name)+"</span> <span class=\\"badge "+t.status+"\\" style=\\"margin-left:8px\\">"+t.status+"</span>"+(t.confirmed?" <span class=\\"badge confirmed\\" style=\\"margin-left:4px\\">confirmed</span>":"")+"</div>";\
  }).join(""):"<div class=\\"empty\\">Nothing yet!</div>";\
}\
\
function showAddCustomer(){$("modalBody").innerHTML="<h3>Hey, lets add someone new</h3><div class=\\"mform\\">\
  <div class=\\"field\\"><label>Name</label><input id=\\"cName\\" placeholder=\\"What is their name?\\"></div>\
  <div class=\\"field\\"><label>Email</label><input id=\\"cEmail\\" type=\\"email\\" placeholder=\\"email@example.com\\"></div>\
  <div class=\\"field\\"><label>Phone</label><input id=\\"cPhone\\" placeholder=\\"optional\\"></div>\
  <div class=\\"field\\"><label>Passport</label><input id=\\"cPassport\\" placeholder=\\"optional\\"></div>\
  <button class=\\"btn\\" data-act=\\"saveCustomer\\" style=\\"margin-top:12px\\">Save</button></div>";$("modal").classList.add("show")}\
\
function showAddTrip(){\
  $("modalBody").innerHTML="<h3>Where are they headed?</h3><div class=\\"mform\\">\
  <div class=\\"field\\"><label>Who is going?</label><select id=\\"tCustomer\\">"+customers.map(function(c){return "<option value=\\""+esc(c.id)+"\\">"+esc(c.name)+"</option>"}).join("")+"</select></div>\
  <div class=\\"field\\"><label>Trip Name</label><input id=\\"tTitle\\" placeholder=\\"e.g. Cancun Getaway\\"></div>\
  <div class=\\"field\\"><label>Destination</label><input id=\\"tDest\\" placeholder=\\"Where to?\\"></div>\
  <div class=\\"row2\\"><div class=\\"field\\"><label>Start</label><input id=\\"tStart\\" type=\\"date\\"></div><div class=\\"field\\"><label>End</label><input id=\\"tEnd\\" type=\\"date\\"></div></div>\
  <div class=\\"field\\"><label>Notes</label><textarea id=\\"tNotes\\" rows=\\"2\\" placeholder=\\"Anything we should know?\\"></textarea></div>\
  <button class=\\"btn\\" data-act=\\"saveTrip\\" style=\\"margin-top:12px\\">Save</button></div>";$("modal").classList.add("show")}\
\
async function doAddCustomer(){\
  var name=$("cName").value,email=$("cEmail").value,phone=$("cPhone").value,passport=$("cPassport").value;\
  if(!name||!email)return alert("Need a name and email!");\
  await api("/api/customers",{method:"POST",body:JSON.stringify({name:name,email:email,phone:phone,passport:passport})});\
  $("modal").classList.remove("show");loadCustomers();loadDashboard();\
}\
\
async function doAddTrip(){\
  var cid=$("tCustomer").value,title=$("tTitle").value,dest=$("tDest").value,sd=$("tStart").value,ed=$("tEnd").value,notes=$("tNotes").value;\
  if(!cid||!title)return alert("Need a person and a trip name!");\
  await api("/api/trips",{method:"POST",body:JSON.stringify({customer_id:cid,title:title,destination:dest,start_date:sd,end_date:ed,notes:notes})});\
  $("modal").classList.remove("show");loadTrips();loadDashboard();\
}\
\
async function doDelCustomer(id){if(!confirm("Delete this person and all their trips?"))return;await api("/api/customers/"+id,{method:"DELETE"});loadCustomers();loadTrips();loadDashboard()}\
async function doDelTrip(id){if(!confirm("Delete this trip?"))return;await api("/api/trips/"+id,{method:"DELETE"});loadTrips();loadDashboard()}\
async function doToggleStatus(id,cur){var n=cur==="upcoming"?"active":cur==="active"?"completed":"upcoming";await api("/api/trips/"+id,{method:"PUT",body:JSON.stringify({status:n})});loadTrips();loadDashboard()}\
\
async function doOpenTrip(tripId){\
  currentTripId=tripId;\
  var trip=await api("/api/trips/"+tripId);\
  var c=customers.find(function(c2){return c2.email===trip.customer_email});\
  currentToken=c?c.token:"";\
  var items=trip.itinerary||[];\
  var notifs=trip.notifications||[];\
  var grouped={};items.forEach(function(i){(grouped[i.day_number]=grouped[i.day_number]||[]).push(i)});\
  var h="<h3>"+esc(trip.title)+"</h3>";\
  h+="<div style=\\"margin:8px 0\\"><span class=\\"badge "+trip.status+"\\">"+trip.status+"</span> "+(trip.confirmed?"<span class=\\"badge confirmed\\">confirmed</span>":"<span class=\\"badge unconfirmed\\">not confirmed</span>")+"</div>";\
  h+="<div style=\\"font-size:13px;color:#8ab4f8;margin-bottom:16px\\">"+esc(trip.customer_name)+" &middot; "+esc(trip.destination||"TBD")+" &middot; "+(trip.start_date||"?")+" to "+(trip.end_date||"?")+"</div>";\
  h+="<h4 style=\\"color:#8ab4f8;font-size:14px;margin:16px 0 8px\\">Itinerary</h4>";\
  if(Object.keys(grouped).length){\
    Object.keys(grouped).forEach(function(day){\
      h+="<div style=\\"color:#f0c040;font-weight:600;margin:10px 0 6px\\">Day "+day+"</div>";\
      grouped[day].forEach(function(e){\
        h+="<div class=\\"itin-item\\"><span class=\\"time\\">"+esc(e.time)+"</span><span class=\\"info\\">"+esc(e.title)+(e.location?" @ "+esc(e.location):"")+"</span><span class=\\"type\\">"+e.type+"</span><button class=\\"btn small danger\\" data-act=\\"delItin\\" data-itinid=\\""+esc(e.id)+"\\" data-tripid=\\""+esc(tripId)+"\\">X</button></div>";\
      });\
    });\
  }else{h+="<div style=\\"color:#666;font-size:13px\\">No items yet — they can add from their portal</div>"}\
  h+="<h4 style=\\"color:#8ab4f8;font-size:14px;margin:16px 0 8px\\">Add Something</h4>";\
  h+="<div class=\\"mform\\"><div class=\\"row2\\"><div class=\\"field\\"><label>Day</label><input id=\\"iDay\\" type=\\"number\\" value=\\"1\\" min=\\"1\\"></div><div class=\\"field\\"><label>Time</label><input id=\\"iTime\\" placeholder=\\"09:00\\"></div></div>";\
  h+="<div class=\\"field\\"><label>What</label><input id=\\"iName\\" placeholder=\\"e.g. Airport pickup\\"></div>";\
  h+="<div class=\\"row2\\"><div class=\\"field\\"><label>Type</label><select id=\\"iType\\"><option value=\\"activity\\">Activity</option><option value=\\"flight\\">Flight</option><option value=\\"hotel\\">Hotel</option><option value=\\"restaurant\\">Restaurant</option><option value=\\"transport\\">Transport</option><option value=\\"note\\">Note</option></select></div><div class=\\"field\\"><label>Location</label><input id=\\"iLoc\\" placeholder=\\"Where?\\"></div></div>";\
  h+="<div class=\\"field\\"><label>Details</label><textarea id=\\"iDesc\\" rows=\\"2\\" placeholder=\\"Notes, confirmation #s...\\"></textarea></div>";\
  h+="<button class=\\"btn small\\" data-act=\\"saveItin\\">Add to Itinerary</button></div>";\
  h+="<hr style=\\"border-color:#1e3a5f;margin:20px 0\\">";\
  h+="<h4 style=\\"color:#8ab4f8;font-size:14px;margin-bottom:8px\\">Send Update</h4>";\
  h+="<div class=\\"mform\\"><div class=\\"field\\"><label>Type</label><select id=\\"nType\\"><option value=\\"update\\">Update</option><option value=\\"delay\\">Delay</option><option value=\\"alert\\">Alert</option><option value=\\"change\\">Change</option><option value=\\"cancel\\">Cancellation</option></select></div>";\
  h+="<div class=\\"field\\"><label>Message</label><textarea id=\\"nMsg\\" rows=\\"3\\" placeholder=\\"What do they need to know?\\"></textarea></div>";\
  h+="<button class=\\"btn small\\" data-act=\\"sendUpdate\\">Send</button>";\
  h+="<div id=\\"notifResult\\" style=\\"margin-top:8px;font-size:12px;display:none\\"></div></div>";\
  if(notifs.length){\
    h+="<hr style=\\"border-color:#1e3a5f;margin:20px 0\\">";\
    h+="<h4 style=\\"color:#8ab4f8;font-size:14px;margin-bottom:8px\\">Sent Updates</h4>";\
    notifs.forEach(function(n){\
      h+="<div class=\\"notif-item "+n.type+"\\"><div style=\\"display:flex;justify-content:space-between;margin-bottom:4px\\"><span style=\\"color:#8ab4f8;font-size:11px;text-transform:uppercase\\">"+n.type+"</span><span style=\\"color:#666;font-size:11px\\">"+new Date(n.created_at).toLocaleString()+"</span></div><div>"+esc(n.message)+"</div></div>";\
    });\
  }\
  h+="<div style=\\"text-align:center;margin-top:16px\\"><a href=\\""+(currentToken?"/portal/"+currentToken:"#")+"\\" target=\\"_blank\\" style=\\"color:#4da6ff;font-size:13px;text-decoration:none\\">View Customer Portal</a></div>";\
  $("modalBody").innerHTML=h;\
  $("modal").classList.add("show");\
}\
\
async function doAddItinItem(){\
  var day=parseInt($("iDay").value)||1,time=$("iTime").value,title=$("iName").value,type=$("iType").value,loc=$("iLoc").value,desc=$("iDesc").value;\
  if(!title)return alert("Need at least a name for this item");\
  await api("/api/trips/"+currentTripId+"/itinerary",{method:"POST",body:JSON.stringify({day_number:day,time:time,title:title,type:type,location:loc,description:desc})});\
  doOpenTrip(currentTripId);\
}\
\
async function doDelItin(itinId,tripId){await api("/api/itinerary/"+itinId,{method:"DELETE"});doOpenTrip(tripId)}\
\
async function doSendNotif(){\
  var msg=$("nMsg").value,type=$("nType").value;\
  if(!msg)return alert("Type a message first");\
  var r=await api("/api/trips/"+currentTripId+"/notifications",{method:"POST",body:JSON.stringify({message:msg,type:type})});\
  var res=$("notifResult");res.style.display="block";res.style.color="#4dff88";res.textContent="Sent! Ref: #"+r.code;\
  $("nMsg").value="";doOpenTrip(currentTripId);\
}\
\
function copyLink(token){var url=window.location.origin+"/portal/"+token;navigator.clipboard.writeText(url).then(function(){alert("Portal link copied!")}).catch(function(){prompt("Copy this link:",url)})}\
\
loadDashboard();\
</script></body></html>';
}

app.listen(PORT, '0.0.0.0', () => console.log('TripTrack running on http://localhost:' + PORT));
