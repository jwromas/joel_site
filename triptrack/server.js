const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;
const DB = path.join(__dirname, 'data.json');

function load() { return fs.existsSync(DB) ? JSON.parse(fs.readFileSync(DB)) : { customers: [], trips: [], itinerary: [], documents: [] }; }
function save(data) { fs.writeFileSync(DB, JSON.stringify(data, null, 2)); }
function genId(prefix) { return prefix + '_' + crypto.randomBytes(8).toString('hex'); }
function genToken() { return crypto.randomBytes(16).toString('hex'); }

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
  const c = { id: genId('cust'), name, email, phone: phone || '', passport: passport || '', token: genToken(), created_at: new Date().toISOString() };
  d.customers.push(c);
  save(d);
  res.json({ id: c.id, token: c.token, name: c.name, email: c.email });
});

app.delete('/api/customers/:id', (req, res) => {
  const d = load();
  const tripIds = d.trips.filter(t => t.customer_id === req.params.id).map(t => t.id);
  d.itinerary = d.itinerary.filter(i => !tripIds.includes(i.trip_id));
  d.documents = d.documents.filter(d2 => !tripIds.includes(d2.trip_id));
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
    return { ...t, customer_name: c.name, customer_email: c.email };
  });
  res.json(trips);
});

app.get('/api/trips/:id', (req, res) => {
  const d = load();
  const trip = d.trips.find(t => t.id === req.params.id);
  if (!trip) return res.status(404).json({ error: 'trip not found' });
  const c = d.customers.find(c2 => c2.id === trip.customer_id) || {};
  const items = d.itinerary.filter(i => i.trip_id === trip.id);
  const docs = d.documents.filter(d2 => d2.trip_id === trip.id);
  res.json({ ...trip, customer_name: c.name, customer_email: c.email, customer_phone: c.phone, itinerary: items, documents: docs });
});

app.post('/api/trips', (req, res) => {
  const { customer_id, title, destination, start_date, end_date, notes } = req.body;
  if (!customer_id || !title) return res.status(400).json({ error: 'customer_id and title required' });
  const d = load();
  const t = { id: genId('trip'), customer_id, title, destination: destination || '', start_date: start_date || '', end_date: end_date || '', status: 'upcoming', notes: notes || '', created_at: new Date().toISOString() };
  d.trips.push(t);
  save(d);
  res.json({ id: t.id, title: t.title });
});

app.put('/api/trips/:id', (req, res) => {
  const d = load();
  const trip = d.trips.find(t => t.id === req.params.id);
  if (!trip) return res.status(404).json({ error: 'not found' });
  const { title, destination, start_date, end_date, status, notes } = req.body;
  if (title) trip.title = title;
  if (destination) trip.destination = destination;
  if (start_date) trip.start_date = start_date;
  if (end_date) trip.end_date = end_date;
  if (status) trip.status = status;
  if (notes !== undefined) trip.notes = notes;
  save(d);
  res.json({ ok: true });
});

app.delete('/api/trips/:id', (req, res) => {
  const d = load();
  d.itinerary = d.itinerary.filter(i => i.trip_id !== req.params.id);
  d.documents = d.documents.filter(d2 => d2.trip_id !== req.params.id);
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

// ── API: Documents ──────────────────────────────────────────
app.post('/api/trips/:id/documents', (req, res) => {
  const { name, type, notes } = req.body;
  if (!name) return res.status(400).json({ error: 'name required' });
  const d = load();
  const doc = { id: genId('doc'), trip_id: req.params.id, name, type: type || 'general', notes: notes || '', created_at: new Date().toISOString() };
  d.documents.push(doc);
  save(d);
  res.json({ id: doc.id });
});

app.delete('/api/documents/:id', (req, res) => {
  const d = load();
  d.documents = d.documents.filter(d2 => d2.id !== req.params.id);
  save(d);
  res.json({ ok: true });
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
  const docs = d.documents.filter(d2 => d2.trip_id === trip.id);
  res.send(portalTripHTML(customer, trip, items, docs, req.params.token));
});

// ── Customer Self-Service: Fill Out Their Trip ──────────────
app.get('/portal/:token/trip/:tripId/edit', (req, res) => {
  const d = load();
  const customer = d.customers.find(c => c.token === req.params.token);
  if (!customer) return res.status(404).send('Invalid link');
  const trip = d.trips.find(t => t.id === req.params.tripId && t.customer_id === customer.id);
  if (!trip) return res.status(404).send('Trip not found');
  const items = d.itinerary.filter(i => i.trip_id === trip.id);
  const docs = d.documents.filter(d2 => d2.trip_id === trip.id);
  res.send(portalEditHTML(customer, trip, items, docs, req.params.token));
});

app.post('/portal/:token/trip/:tripId/itinerary', (req, res) => {
  const d = load();
  const customer = d.customers.find(c => c.token === req.params.token);
  if (!customer) return res.status(404).json({ error: 'Invalid' });
  const trip = d.trips.find(t => t.id === req.params.tripId && t.customer_id === customer.id);
  if (!trip) return res.status(404).json({ error: 'Trip not found' });
  const { day_number, time, title, description, location, type } = req.body;
  if (!title) return res.status(400).json({ error: 'title required' });
  const item = { id: genId('itin'), trip_id: trip.id, day_number: day_number || 1, time: time || '', title, description: description || '', location: location || '', type: type || 'activity' };
  d.itinerary.push(item);
  save(d);
  res.redirect('/portal/' + req.params.token + '/trip/' + req.params.tripId + '/edit');
});

app.post('/portal/:token/trip/:tripId/documents', (req, res) => {
  const d = load();
  const customer = d.customers.find(c => c.token === req.params.token);
  if (!customer) return res.status(404).json({ error: 'Invalid' });
  const trip = d.trips.find(t => t.id === req.params.tripId && t.customer_id === customer.id);
  if (!trip) return res.status(404).json({ error: 'Trip not found' });
  const { name, type, notes } = req.body;
  if (!name) return res.status(400).json({ error: 'name required' });
  const doc = { id: genId('doc'), trip_id: trip.id, name, type: type || 'general', notes: notes || '', created_at: new Date().toISOString() };
  d.documents.push(doc);
  save(d);
  res.redirect('/portal/' + req.params.token + '/trip/' + req.params.tripId + '/edit');
});

app.post('/portal/:token/trip/:tripId/delete-itin/:itemId', (req, res) => {
  const d = load();
  d.itinerary = d.itinerary.filter(i => i.id !== req.params.itemId);
  save(d);
  res.redirect('/portal/' + req.params.token + '/trip/' + req.params.tripId + '/edit');
});

app.post('/portal/:token/trip/:tripId/delete-doc/:docId', (req, res) => {
  const d = load();
  d.documents = d.documents.filter(d2 => d2.id !== req.params.docId);
  save(d);
  res.redirect('/portal/' + req.params.token + '/trip/' + req.params.tripId + '/edit');
});

// ── Admin Dashboard ─────────────────────────────────────────
app.get('/', (req, res) => res.send(dashboardHTML()));
app.get('/admin', (req, res) => res.send(dashboardHTML()));

// ── HTML: Customer Portal ───────────────────────────────────
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
.trip-card{background:#111827;border:1px solid #1e3a5f;border-radius:12px;padding:20px;margin-bottom:16px;transition:border-color .2s}
.trip-card:hover{border-color:#f0c040}
.trip-card h3{color:#f0c040;font-size:18px;margin-bottom:8px}
.trip-meta{display:flex;gap:16px;font-size:13px;color:#8ab4f8;margin-bottom:8px;flex-wrap:wrap}
.trip-status{display:inline-block;padding:3px 10px;border-radius:12px;font-size:12px;font-weight:600}
.trip-status.upcoming{background:#1a3a5c;color:#4da6ff}
.trip-status.active{background:#1a3a1a;color:#4dff88}
.trip-status.completed{background:#3a1a3a;color:#ff8aff}
.no-trips{text-align:center;padding:40px;color:#666;font-size:16px}
</style></head><body>
<div class="topbar"><h1>JOEL JOURNEYS</h1><p>Your Travel Dashboard</p></div>
<div class="container">
<div class="welcome">Welcome, ${customer.name}!</div>
${trips.length === 0 ? '<div class="no-trips">No trips yet. Your travel concierge will add your first trip soon!</div>' : 
trips.map(t => `<a href="/portal/${token}/trip/${t.id}" style="text-decoration:none;color:inherit">
<div class="trip-card">
  <h3>${esc(t.title)}</h3>
  <div class="trip-meta">
    <span>${esc(t.destination) || 'TBD'}</span>
    <span>${t.start_date || '?'} - ${t.end_date || '?'}</span>
  </div>
  <span class="trip-status ${t.status}">${t.status}</span>
</div></a>`).join('')}
</div></body></html>`;
}

function portalTripHTML(customer, trip, items, docs, token) {
  const grouped = {};
  items.forEach(i => { (grouped[i.day_number] = grouped[i.day_number] || []).push(i); });
  const icons = { flight: '\u2708\uFE0F', hotel: '\uD83C\uDFE8', activity: '\uD83C\uDFAF', restaurant: '\uD83C\uDF7D\uFE0F', transport: '\uD83D\uDE8C', note: '\uD83D\uDCDD' };
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
.docs{margin-top:24px}.docs h3{color:#f0c040;margin-bottom:12px}
.doc-item{background:#111827;border:1px solid #1e3a5f;border-radius:8px;padding:12px;margin-bottom:8px;display:flex;align-items:center;gap:12px}
.no-content{text-align:center;padding:30px;color:#666}
</style></head><body>
<div class="topbar"><h1>${esc(trip.title)}</h1><div><a href="/portal/${token}/trip/${trip.id}/edit" style="color:#f0c040;margin-right:16px">Plan Your Trip</a><a href="/portal/${token}">Back to My Trips</a></div></div>
<div class="container">
<div class="trip-header">
  <h2>${esc(trip.title)}</h2>
  <div class="trip-meta">
    <span>${esc(trip.destination) || 'Destination TBD'}</span>
    <span>${trip.start_date || '?'} - ${trip.end_date || '?'}</span>
    <span class="trip-status ${trip.status}">${trip.status}</span>
  </div>
  ${trip.notes ? '<p style="margin-top:8px;color:#aaa;font-size:14px">'+esc(trip.notes)+'</p>' : ''}
</div>
${Object.keys(grouped).length === 0 && docs.length === 0 ? '<div class="no-content">Itinerary coming soon!</div>' : ''}
${Object.entries(grouped).map(([day, events]) => `
<div class="day-section">
  <div class="day-title">Day ${day}</div>
  ${events.map(e => '<div class="tl"><div class="time">'+esc(e.time)+'</div><div class="icon">'+(icons[e.type]||'\uD83D\uDCCC')+'</div><div class="content"><h4>'+esc(e.title)+'</h4><p>'+esc(e.description)+'</p>'+(e.location?'<div class="loc">'+esc(e.location)+'</div>':'')+'</div></div>').join('')}
</div>`).join('')}
${docs.length > 0 ? '<div class="docs"><h3>Documents</h3>'+docs.map(d => '<div class="doc-item"><div style="font-size:24px">'+(d.type==='ticket'?'\u2708\uFE0F':d.type==='hotel'?'\uD83C\uDFE8':'\uD83D\uDCC4')+'</div><div><strong>'+esc(d.name)+'</strong>'+(d.notes?'<br><small style="color:#aaa">'+esc(d.notes)+'</small>':'')+'</div></div>').join('')+'</div>' : ''}
</div></body></html>`;
}

function esc(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

// ── HTML: Customer Self-Service Edit Page ───────────────────
function portalEditHTML(customer, trip, items, docs, token) {
  const grouped = {};
  items.forEach(i => { (grouped[i.day_number] = grouped[i.day_number] || []).push(i); });
  const icons = { flight: '\u2708\uFE0F', hotel: '\uD83C\uDFE8', activity: '\uD83C\uDFAF', restaurant: '\uD83C\uDF7D\uFE0F', transport: '\uD83D\uDE8C', note: '\uD83D\uDCDD' };
  const days = Object.keys(grouped).map(Number).sort((a,b)=>a-b);
  const maxDay = days.length ? Math.max(...days) : 1;
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
</style></head><body>
<div class="topbar">
  <h1>Plan: ${esc(trip.title)}</h1>
  <a href="/portal/${token}/trip/${trip.id}">View Trip &rarr;</a>
</div>
<div class="container">
<h2>Build Your Itinerary</h2>
<div class="info-bar">
  <span>${esc(trip.destination) || 'Destination TBD'}</span>
  <span>${trip.start_date || '?'} - ${trip.end_date || '?'}</span>
</div>
<div class="tip"><strong>Tip:</strong> Add your planned activities, flights, hotel check-ins, and restaurant reservations below. Organize by day and time so your itinerary is easy to follow during your trip.</div>

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

<div class="form-card">
<h3>Add Document</h3>
<form method="POST" action="/portal/${token}/trip/${trip.id}/documents">
  <div class="row">
    <div><label>Document Name *</label><input type="text" name="name" placeholder="e.g. Flight confirmation" required></div>
    <div><label>Type</label>
      <select name="type">
        <option value="general">General</option>
        <option value="ticket">Flight Ticket</option>
        <option value="hotel">Hotel Booking</option>
        <option value="visa">Visa</option>
        <option value="insurance">Travel Insurance</option>
      </select>
    </div>
  </div>
  <label>Notes</label>
  <input type="text" name="notes" placeholder="Confirmation #, booking ref, etc.">
  <button type="submit" class="btn">Add Document</button>
</form>
</div>

${items.length > 0 ? '<h3>Your Itinerary</h3>' + Object.entries(grouped).map(([day, events]) => `
<div class="day-header">Day ${day}</div>
${events.map(e => '<div class="itin-item"><div class="time">'+esc(e.time)+'</div><div class="icon">'+(icons[e.type]||'\uD83D\uDCCC')+'</div><div class="info"><h4>'+esc(e.title)+'</h4><p>'+esc(e.description)+'</p>'+(e.location?'<div class="loc">'+esc(e.location)+'</div>':'')+'</div><form method="POST" action="/portal/'+token+'/trip/'+trip.id+'/delete-itin/'+e.id+'" style="margin:0"><button type="submit" class="btn small danger" onclick="return confirm(\'Delete this item?\')">X</button></form></div>').join('')}`).join('') : ''}

${docs.length > 0 ? '<h3>Documents</h3>' + docs.map(d => '<div class="itin-item"><div class="icon">'+(d.type==='ticket'?'\u2708\uFE0F':d.type==='hotel'?'\uD83C\uDFE8':'\uD83D\uDCC4')+'</div><div class="info"><h4>'+esc(d.name)+'</h4><p>'+esc(d.notes)+'</p></div><form method="POST" action="/portal/'+token+'/trip/'+trip.id+'/delete-doc/'+d.id+'" style="margin:0"><button type="submit" class="btn small danger" onclick="return confirm(\'Delete this?\')">X</button></form></div>').join('') : ''}

<div style="text-align:center;margin:30px 0"><a href="/portal/${token}/trip/${trip.id}" style="color:#f0c040;font-size:16px;text-decoration:none">View My Trip &rarr;</a></div>
</div></body></html>`;
}

// ── HTML: Admin Dashboard ───────────────────────────────────
function dashboardHTML() {
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>TripTrack - Admin</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Segoe UI',sans-serif;background:#0a0f1a;color:#e0e0e0;min-height:100vh}
.topbar{background:linear-gradient(135deg,#0d2137,#1a3a5c);padding:16px 24px;border-bottom:2px solid #f0c040;display:flex;align-items:center;justify-content:space-between}
.topbar h1{color:#f0c040;font-size:20px;letter-spacing:2px}
.topbar span{color:#8ab4f8;font-size:13px}
.tabs{display:flex;background:#111827;border-bottom:1px solid #1e3a5f}
.tab{padding:12px 24px;cursor:pointer;color:#8ab4f8;border-bottom:2px solid transparent;font-size:14px;transition:all .2s}
.tab:hover{color:#fff}
.tab.active{color:#f0c040;border-bottom-color:#f0c040}
.container{max-width:1100px;margin:20px auto;padding:0 16px}
.panel{display:none}.panel.active{display:block}
.btn{background:#f0c040;color:#0a0f1a;border:none;border-radius:8px;padding:10px 20px;font-size:14px;font-weight:700;cursor:pointer;transition:background .2s}
.btn:hover{background:#ffe066}
.btn.danger{background:#ff4d4d;color:#fff}
.btn.small{padding:6px 12px;font-size:12px}
.btn.secondary{background:#1e3a5f;color:#8ab4f8}
.form-row{display:flex;gap:12px;margin-bottom:12px;flex-wrap:wrap}
.form-row input,.form-row select,.form-row textarea{background:#111827;color:#e0e0e0;border:1px solid #1e3a5f;border-radius:8px;padding:10px 14px;font-size:14px;flex:1;min-width:180px;outline:none}
.form-row input:focus,.form-row select:focus{border-color:#f0c040}
table{width:100%;border-collapse:collapse;margin-top:16px}
th{text-align:left;padding:10px;color:#f0c040;border-bottom:1px solid #1e3a5f;font-size:13px}
td{padding:10px;border-bottom:1px solid #0d1f33;font-size:14px}
tr:hover td{background:#111827}
.badge{display:inline-block;padding:2px 8px;border-radius:10px;font-size:11px;font-weight:600}
.badge.upcoming{background:#1a3a5c;color:#4da6ff}
.badge.active{background:#1a3a1a;color:#4dff88}
.badge.completed{background:#3a1a3a;color:#ff8aff}
.modal{display:none;position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,.7);z-index:100;align-items:center;justify-content:center}
.modal.show{display:flex}
.modal-content{background:#111827;border:1px solid #1e3a5f;border-radius:12px;padding:24px;width:90%;max-width:650px;max-height:85vh;overflow-y:auto}
.modal-content h3{color:#f0c040;margin-bottom:16px}
.close-btn{float:right;background:none;border:none;color:#8ab4f8;font-size:24px;cursor:pointer}
.close-btn:hover{color:#fff}
.itin-row{display:flex;gap:8px;align-items:center;margin-bottom:8px;flex-wrap:wrap}
.itin-row input,.itin-row select{background:#0a0f1a;color:#e0e0e0;border:1px solid #1e3a5f;border-radius:6px;padding:8px;font-size:13px}
.itin-row input:nth-child(1){width:55px}
.itin-row input:nth-child(2){width:65px}
.itin-row input:nth-child(3){flex:1;min-width:120px}
.itin-row select{width:100px}
.empty{text-align:center;padding:30px;color:#666}
.stats{display:flex;gap:16px;margin-bottom:20px}
.stat-card{background:#111827;border:1px solid #1e3a5f;border-radius:10px;padding:16px 24px;text-align:center;flex:1}
.stat-card .num{font-size:28px;color:#f0c040;font-weight:700}
.stat-card .label{font-size:12px;color:#8ab4f8;margin-top:4px}
</style></head><body>
<div class="topbar"><h1>TRIPTRACK</h1><span>Joel Journeys Admin</span></div>
<div class="tabs">
  <div class="tab active" onclick="showTab('dashboard')">Dashboard</div>
  <div class="tab" onclick="showTab('customers')">Customers</div>
  <div class="tab" onclick="showTab('trips')">Trips</div>
</div>
<div class="container">
<div id="dashboard" class="panel active">
  <div class="stats"><div class="stat-card"><div class="num" id="sCust">0</div><div class="label">Customers</div></div>
  <div class="stat-card"><div class="num" id="sTrips">0</div><div class="label">Trips</div></div>
  <div class="stat-card"><div class="num" id="sUpcoming">0</div><div class="label">Upcoming</div></div>
  <div class="stat-card"><div class="num" id="sActive">0</div><div class="label">Active</div></div></div>
  <h3 style="color:#8ab4f8;margin-bottom:12px">Recent Activity</h3>
  <div id="recentTrips"></div>
</div>
<div id="customers" class="panel">
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
    <h2>Customers</h2><button class="btn" onclick="showAddCustomer()">+ Add Customer</button>
  </div>
  <table><thead><tr><th>Name</th><th>Email</th><th>Phone</th><th>Trips</th><th>Portal</th><th></th></tr></thead>
  <tbody id="customerTable"></tbody></table>
</div>
<div id="trips" class="panel">
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
    <h2>Trips</h2><button class="btn" onclick="showAddTrip()">+ Add Trip</button>
  </div>
  <table><thead><tr><th>Customer</th><th>Trip</th><th>Destination</th><th>Dates</th><th>Status</th><th></th></tr></thead>
  <tbody id="tripTable"></tbody></table>
</div>
</div>
<div class="modal" id="addCustomerModal"><div class="modal-content">
  <button class="close-btn" onclick="closeModal('addCustomerModal')">&times;</button>
  <h3>Add Customer</h3>
  <div class="form-row"><input id="cName" placeholder="Full Name"></div>
  <div class="form-row"><input id="cEmail" type="email" placeholder="Email"></div>
  <div class="form-row"><input id="cPhone" placeholder="Phone"></div>
  <div class="form-row"><input id="cPassport" placeholder="Passport #"></div>
  <button class="btn" onclick="addCustomer()" style="margin-top:12px">Save Customer</button>
</div></div>
<div class="modal" id="addTripModal"><div class="modal-content">
  <button class="close-btn" onclick="closeModal('addTripModal')">&times;</button>
  <h3>Add Trip</h3>
  <div class="form-row"><select id="tCustomer"></select></div>
  <div class="form-row"><input id="tTitle" placeholder="Trip Title"></div>
  <div class="form-row"><input id="tDest" placeholder="Destination"></div>
  <div class="form-row"><input id="tStart" type="date"><input id="tEnd" type="date"></div>
  <div class="form-row"><textarea id="tNotes" rows="2" placeholder="Notes"></textarea></div>
  <button class="btn" onclick="addTrip()" style="margin-top:12px">Save Trip</button>
</div></div>
<div class="modal" id="itinModal"><div class="modal-content" style="max-width:700px">
  <button class="close-btn" onclick="closeModal('itinModal')">&times;</button>
  <h3 id="itinTitle">Itinerary</h3>
  <div id="itinList"></div>
  <div class="itin-row" style="margin-top:12px">
    <input id="iDay" type="number" placeholder="Day" value="1" min="1">
    <input id="iTime" placeholder="Time">
    <input id="iName" placeholder="Activity name">
    <select id="iType"><option value="activity">Activity</option><option value="flight">Flight</option><option value="hotel">Hotel</option><option value="restaurant">Restaurant</option><option value="transport">Transport</option><option value="note">Note</option></select>
  </div>
  <div class="form-row"><input id="iLoc" placeholder="Location"></div>
  <div class="form-row"><textarea id="iDesc" rows="2" placeholder="Description"></textarea></div>
  <button class="btn small" onclick="addItinItem()" style="margin-top:8px">+ Add Item</button>
  <hr style="border-color:#1e3a5f;margin:16px 0">
  <h4 style="color:#8ab4f8;margin-bottom:8px">Documents</h4>
  <div id="docList"></div>
  <div class="form-row" style="margin-top:8px">
    <input id="dName" placeholder="Document name">
    <select id="dType"><option value="general">General</option><option value="ticket">Ticket</option><option value="hotel">Hotel</option><option value="visa">Visa</option><option value="insurance">Insurance</option></select>
    <input id="dNotes" placeholder="Notes">
  </div>
  <button class="btn small" onclick="addDoc()" style="margin-top:8px">+ Add Document</button>
  <div style="margin-top:16px;text-align:center"><a id="portalLink" href="#" target="_blank" style="color:#4da6ff;font-size:13px">View Customer Portal</a></div>
</div></div>
<script>
let customers=[], trips=[], currentTripId='', currentToken='';
async function api(url, opts) { const r = await fetch(url, {headers:{'Content-Type':'application/json'}, ...opts}); return r.json(); }
function showTab(id) { document.querySelectorAll('.panel').forEach(p=>p.classList.remove('active')); document.querySelectorAll('.tab').forEach(t=>t.classList.remove('active')); document.getElementById(id).classList.add('active'); document.querySelectorAll('.tab')[{dashboard:0,customers:1,trips:2}[id]].classList.add('active'); if(id==='trips')loadTrips(); if(id==='dashboard')loadDashboard(); }
function closeModal(id) { document.getElementById(id).classList.remove('show'); }

async function loadCustomers() {
  customers = await api('/api/customers');
  const tb = document.getElementById('customerTable');
  if(!customers.length){tb.innerHTML='<tr><td colspan="6" class="empty">No customers yet</td></tr>';return;}
  tb.innerHTML = customers.map(c=>'<tr><td><strong>'+esc(c.name)+'</strong></td><td>'+esc(c.email)+'</td><td>'+(c.phone||'-')+'</td><td>'+c.trip_count+'</td><td><a href="/portal/'+c.token+'" target="_blank" style="color:#4da6ff;font-size:12px">Open</a></td><td><button class="btn small danger" onclick="delCustomer(\''+c.id+'\')">X</button></td></tr>').join('');
}

async function loadTrips() {
  trips = await api('/api/trips');
  const tb = document.getElementById('tripTable');
  if(!trips.length){tb.innerHTML='<tr><td colspan="6" class="empty">No trips yet</td></tr>';return;}
  tb.innerHTML = trips.map(t=>'<tr><td>'+esc(t.customer_name)+'</td><td><strong>'+esc(t.title)+'</strong></td><td>'+esc(t.destination||'-')+'</td><td>'+(t.start_date||'?')+' - '+(t.end_date||'?')+'</td><td><span class="badge '+t.status+'">'+t.status+'</span></td><td><button class="btn small secondary" onclick="openItin(\''+t.id+'\')">Itinerary</button> <button class="btn small" onclick="toggleStatus(\''+t.id+'\',\''+t.status+'\')">Toggle</button> <button class="btn small danger" onclick="delTrip(\''+t.id+'\')">X</button></td></tr>').join('');
}

async function loadDashboard() {
  await loadCustomers();
  await loadTrips();
  document.getElementById('sCust').textContent = customers.length;
  document.getElementById('sTrips').textContent = trips.length;
  document.getElementById('sUpcoming').textContent = trips.filter(t=>t.status==='upcoming').length;
  document.getElementById('sActive').textContent = trips.filter(t=>t.status==='active').length;
  const recent = trips.slice(0,5);
  document.getElementById('recentTrips').innerHTML = recent.length ? recent.map(t=>'<div style="background:#111827;border:1px solid #1e3a5f;border-radius:8px;padding:12px;margin-bottom:8px"><strong>'+esc(t.title)+'</strong> <span style="color:#8ab4f8;font-size:13px">- '+esc(t.customer_name)+'</span> <span class="badge '+t.status+'" style="margin-left:8px">'+t.status+'</span></div>').join('') : '<div class="empty">No trips yet</div>';
}

function showAddCustomer(){document.getElementById('addCustomerModal').classList.add('show')}
function showAddTrip(){const s=document.getElementById('tCustomer');s.innerHTML=customers.map(c=>'<option value="'+c.id+'">'+esc(c.name)+'</option>').join('');document.getElementById('addTripModal').classList.add('show')}

async function addCustomer(){const name=document.getElementById('cName').value,email=document.getElementById('cEmail').value,phone=document.getElementById('cPhone').value,passport=document.getElementById('cPassport').value;if(!name||!email)return alert('Name and email required');await api('/api/customers',{method:'POST',body:JSON.stringify({name,email,phone,passport})});closeModal('addCustomerModal');['cName','cEmail','cPhone','cPassport'].forEach(i=>document.getElementById(i).value='');loadCustomers();loadDashboard()}

async function addTrip(){const customer_id=document.getElementById('tCustomer').value,title=document.getElementById('tTitle').value,destination=document.getElementById('tDest').value,start_date=document.getElementById('tStart').value,end_date=document.getElementById('tEnd').value,notes=document.getElementById('tNotes').value;if(!customer_id||!title)return alert('Customer and title required');await api('/api/trips',{method:'POST',body:JSON.stringify({customer_id,title,destination,start_date,end_date,notes})});closeModal('addTripModal');loadTrips();loadDashboard()}

async function delCustomer(id){if(!confirm('Delete customer and all their trips?'))return;await api('/api/customers/'+id,{method:'DELETE'});loadCustomers();loadTrips();loadDashboard()}
async function delTrip(id){if(!confirm('Delete this trip?'))return;await api('/api/trips/'+id,{method:'DELETE'});loadTrips();loadDashboard()}

async function toggleStatus(id,cur){const next=cur==='upcoming'?'active':cur==='active'?'completed':'upcoming';await api('/api/trips/'+id,{method:'PUT',body:JSON.stringify({status:next})});loadTrips();loadDashboard()}

async function openItin(tripId){currentTripId=tripId;const trip=await api('/api/trips/'+tripId);const c=customers.find(c2=>c2.email===trip.customer_email);currentToken=c?c.token:'';document.getElementById('itinTitle').textContent=trip.title+' - Itinerary';const items=trip.itinerary||[];const grouped={};items.forEach(i=>{(grouped[i.day_number]=grouped[i.day_number]||[]).push(i)});let h='';Object.entries(grouped).forEach(([day,evts])=>{h+='<div style="color:#f0c040;margin-top:8px;font-weight:600">Day '+day+'</div>';evts.forEach(e=>{h+='<div class="itin-row"><span style="color:#8ab4f8;font-size:12px;min-width:50px">'+esc(e.time)+'</span><span style="flex:1">'+esc(e.title)+'</span><span style="color:#aaa;font-size:12px">'+e.type+'</span><button class="btn small danger" onclick="delItin(\''+e.id+'\',\''+tripId+'\')">X</button></div>'})});document.getElementById('itinList').innerHTML=h||'<div class="empty">No itinerary items yet</div>';const docs=trip.documents||[];let dh='';docs.forEach(d=>{dh+='<div class="itin-row"><span style="flex:1">'+esc(d.name)+' <small style="color:#aaa">'+d.type+'</small></span><button class="btn small danger" onclick="delDoc(\''+d.id+'\',\''+tripId+'\')">X</button></div>'});document.getElementById('docList').innerHTML=dh||'<div style="color:#666;font-size:13px">No documents</div>';document.getElementById('portalLink').href=currentToken?'/portal/'+currentToken:'#';document.getElementById('itinModal').classList.add('show')}

async function addItinItem(){const day=parseInt(document.getElementById('iDay').value)||1,time=document.getElementById('iTime').value,title=document.getElementById('iName').value,type=document.getElementById('iType').value,location=document.getElementById('iLoc').value,description=document.getElementById('iDesc').value;if(!title)return alert('Name required');await api('/api/trips/'+currentTripId+'/itinerary',{method:'POST',body:JSON.stringify({day_number:day,time,title,type,location,description})});document.getElementById('iName').value='';document.getElementById('iLoc').value='';document.getElementById('iDesc').value='';openItin(currentTripId)}

async function delItin(id,tripId){await api('/api/itinerary/'+id,{method:'DELETE'});openItin(tripId)}

async function addDoc(){const name=document.getElementById('dName').value,type=document.getElementById('dType').value,notes=document.getElementById('dNotes').value;if(!name)return alert('Name required');await api('/api/trips/'+currentTripId+'/documents',{method:'POST',body:JSON.stringify({name,type,notes})});document.getElementById('dName').value='';document.getElementById('dNotes').value='';openItin(currentTripId)}

async function delDoc(id,tripId){await api('/api/documents/'+id,{method:'DELETE'});openItin(tripId)}

function esc(s){return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}

loadDashboard();
</script></body></html>`;
}

app.listen(PORT, '0.0.0.0', () => console.log('TripTrack running on http://localhost:' + PORT));
