const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const https = require('https');
const http = require('http');

const app = express();
const PORT = process.env.PORT || 3000;
const DB = fs.existsSync('/data') ? '/data/data.json' : path.join(__dirname, 'data.json');
const DISCORD_WEBHOOK = process.env.DISCORD_SUPPORT_WEBHOOK || 'https://discord.com/api/webhooks/1531117667895869610/8fXcwyAyKcdCmTPsjQ7hzWX5xM1EY249JqjpD5ORhzRPXqsHD19HbDNYy5WnxZW63rTw';
const TG_BOT_TOKEN = process.env.ROBO_TELEGRAM_TOKEN || '8625114228:AAFJLgorJqPKfWzQzx5NyBoTFfcIwKrUgRI';
const ADMIN_TG_CHAT = process.env.ROBO_TELEGRAM_CHAT || '-1004398146444';

function load() {
  if (!fs.existsSync(DB)) return { customers: [], trips: [], itinerary: [], notifications: [], messages: [] };
  const d = JSON.parse(fs.readFileSync(DB));
  if (!d.messages) d.messages = [];
  return d;
}
function save(d) { fs.writeFileSync(DB, JSON.stringify(d, null, 2)); }
function genId(p) { return p + '_' + crypto.randomBytes(8).toString('hex'); }
function genCode() { return String(Math.floor(1000 + Math.random() * 9000)); }
function esc(s) { return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

function httpPost(url, payload) {
  try {
    var data = typeof payload === 'string' ? payload : JSON.stringify(payload);
    var u = new URL(url);
    var mod = u.protocol === 'https:' ? https : http;
    var req = mod.request({ hostname: u.hostname, port: u.port, path: u.pathname + u.search, method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } }, function(r) { r.resume(); });
    req.on('error', function() {});
    req.write(data);
    req.end();
  } catch (e) {}
}

function notifyAdmin(text) {
  if (DISCORD_WEBHOOK) httpPost(DISCORD_WEBHOOK, { content: text });
  if (TG_BOT_TOKEN && ADMIN_TG_CHAT) {
    httpPost('https://api.telegram.org/bot' + TG_BOT_TOKEN + '/sendMessage', { chat_id: ADMIN_TG_CHAT, text: text, parse_mode: 'HTML' });
  }
}

function httpGet(url) {
  return new Promise(function(resolve, reject) {
    var mod = url.startsWith('https') ? https : http;
    mod.get(url, { headers: { 'User-Agent': 'TripTrack/1.0' }, timeout: 8000 }, function(r) {
      var body = '';
      r.on('data', function(c) { body += c; });
      r.on('end', function() { resolve(body); });
    }).on('error', reject).on('timeout', function() { reject(new Error('timeout')); });
  });
}

function notifyTrip(tripId, message, type) {
  var d = load();
  d.notifications.push({ id: genId('notif'), trip_id: tripId, message: message, type: type || 'update', code: genCode(), read: false, created_at: new Date().toISOString() });
  save(d);
}

async function webhookWeather(tripId, destination) {
  if (!destination) return;
  try {
    var query = destination.split(',')[0].trim();
    var data = JSON.parse(await httpGet('https://wttr.in/' + encodeURIComponent(query) + '?format=j1'));
    var cur = data.current_condition && data.current_condition[0];
    var today = data.weather && data.weather[0];
    if (!cur) return;
    var msg = 'Current weather in ' + destination + ': ' + cur.weatherDesc[0].value + ', ' + cur.temp_F + '\u00B0F (feels like ' + cur.FeelsLikeF + '\u00B0F).';
    if (today) msg += ' Today: High ' + today.maxtempF + '\u00B0F / Low ' + today.mintempF + '\u00B0F.';
    notifyTrip(tripId, msg, 'update');
  } catch (e) {}
}

async function webhookCountry(tripId, destination) {
  if (!destination) return;
  try {
    var country = destination.split(',').pop().trim();
    var data = JSON.parse(await httpGet('https://restcountries.com/v3.1/name/' + encodeURIComponent(country) + '?fields=name,capital,region,currencies,languages,timezones,flags'));
    if (!data || !data.length) return;
    var c = Array.isArray(data) ? data[0] : data;
    var cur = c.currencies ? Object.values(c.currencies).map(function(v) { return v.name + ' (' + v.symbol + ')'; }).join(', ') : 'N/A';
    var msg = c.flags.emoji + ' ' + c.name.common + ': Capital ' + (c.capital ? c.capital[0] : 'N/A') + ', Currency: ' + cur + ', Timezone: ' + (c.timezones ? c.timezones[0] : 'N/A');
    notifyTrip(tripId, msg, 'update');
  } catch (e) {}
}

async function webhookWikipedia(tripId, destination) {
  if (!destination) return;
  try {
    var data = JSON.parse(await httpGet('https://en.wikipedia.org/api/rest_v1/page/summary/' + encodeURIComponent(destination.split(',')[0].trim().replace(/ /g, '_'))));
    if (!data || !data.extract) return;
    notifyTrip(tripId, 'About ' + (data.title || destination) + ': ' + data.extract.substring(0, 250) + '...', 'update');
  } catch (e) {}
}

async function runWebhooks(tripId, destination) {
  if (!destination) return;
  var mapsUrl = 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(destination);
  notifyTrip(tripId, 'Google Maps: ' + mapsUrl, 'update');
  await Promise.all([webhookWeather(tripId, destination), webhookCountry(tripId, destination), webhookWikipedia(tripId, destination)]);
}

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(function(req, res, next) { res.header('Access-Control-Allow-Origin', '*'); res.header('Access-Control-Allow-Headers', 'Content-Type'); res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS'); if (req.method === 'OPTIONS') return res.sendStatus(204); next(); });

app.post('/api/signup', function(req, res) {
  var name = (req.body.name || '').trim();
  var email = (req.body.email || '').trim();
  var phone = (req.body.phone || '').trim();
  if (!name || !email) return res.status(400).json({ error: 'name and email required' });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: 'invalid email' });
  var d = load();
  var existing = d.customers.find(function(c) { return c.email === email; });
  if (existing) return res.status(409).json({ error: 'already registered', access_code: existing.access_code });
  var c = { id: genId('cust'), name: name, email: email, phone: phone, passport: '', access_code: genCode(), created_at: new Date().toISOString() };
  d.customers.push(c);
  save(d);
  notifyAdmin('\uD83D\uDE80 New signup: ' + name + ' (' + email + ')');
  res.json({ ok: true, access_code: c.access_code, name: c.name });
});

app.get('/api/customers', function(req, res) {
  var d = load();
  res.json(d.customers.map(function(c) {
    return Object.assign({}, c, { trip_count: d.trips.filter(function(t) { return t.customer_id === c.id; }).length });
  }));
});

app.post('/api/customers', function(req, res) {
  var name = req.body.name, email = req.body.email;
  if (!name || !email) return res.status(400).json({ error: 'name and email required' });
  var d = load();
  var c = { id: genId('cust'), name: name, email: email, phone: req.body.phone || '', passport: req.body.passport || '', access_code: genCode(), created_at: new Date().toISOString() };
  d.customers.push(c);
  save(d);
  res.json({ id: c.id, name: c.name, email: c.email, access_code: c.access_code });
});

app.delete('/api/customers/:id', function(req, res) {
  var d = load();
  var tripIds = d.trips.filter(function(t) { return t.customer_id === req.params.id; }).map(function(t) { return t.id; });
  d.itinerary = d.itinerary.filter(function(i) { return tripIds.indexOf(i.trip_id) === -1; });
  d.notifications = d.notifications.filter(function(n) { return tripIds.indexOf(n.trip_id) === -1; });
  d.messages = d.messages.filter(function(m) { return m.customer_id !== req.params.id; });
  d.trips = d.trips.filter(function(t) { return t.customer_id !== req.params.id; });
  d.customers = d.customers.filter(function(c) { return c.id !== req.params.id; });
  save(d);
  res.json({ ok: true });
});

app.get('/api/trips', function(req, res) {
  var d = load();
  res.json(d.trips.map(function(t) {
    var c = d.customers.find(function(cu) { return cu.id === t.customer_id; }) || {};
    return Object.assign({}, t, { customer_name: c.name, customer_email: c.email });
  }));
});

app.get('/api/trips/:id', function(req, res) {
  var d = load();
  var t = d.trips.find(function(tr) { return tr.id === req.params.id; });
  if (!t) return res.status(404).json({ error: 'not found' });
  var c = d.customers.find(function(cu) { return cu.id === t.customer_id; }) || {};
  res.json(Object.assign({}, t, { customer_name: c.name, itinerary: d.itinerary.filter(function(i) { return i.trip_id === t.id; }), notifications: d.notifications.filter(function(n) { return n.trip_id === t.id; }) }));
});

app.post('/api/trips', function(req, res) {
  var customer_id = req.body.customer_id, title = req.body.title;
  if (!customer_id || !title) return res.status(400).json({ error: 'customer_id and title required' });
  var d = load();
  var t = { id: genId('trip'), customer_id: customer_id, title: title, destination: req.body.destination || '', start_date: req.body.start_date || '', end_date: req.body.end_date || '', status: 'upcoming', notes: req.body.notes || '', confirmed: false, created_at: new Date().toISOString() };
  d.trips.push(t);
  save(d);
  if (t.destination) runWebhooks(t.id, t.destination);
  var cust = d.customers.find(function(c) { return c.id === customer_id; });
  if (cust) notifyAdmin('\uD83D\uDE80 New trip: ' + title + ' for ' + cust.name + ' (' + (t.destination || 'TBD') + ')');
  res.json({ id: t.id, title: t.title });
});

app.put('/api/trips/:id', function(req, res) {
  var d = load();
  var trip = d.trips.find(function(t) { return t.id === req.params.id; });
  if (!trip) return res.status(404).json({ error: 'not found' });
  var destChanged = req.body.destination && req.body.destination !== trip.destination;
  if (req.body.title) trip.title = req.body.title;
  if (req.body.destination) trip.destination = req.body.destination;
  if (req.body.start_date) trip.start_date = req.body.start_date;
  if (req.body.end_date) trip.end_date = req.body.end_date;
  if (req.body.status) trip.status = req.body.status;
  if (req.body.notes !== undefined) trip.notes = req.body.notes;
  if (req.body.confirmed !== undefined) trip.confirmed = req.body.confirmed;
  save(d);
  if (destChanged) runWebhooks(trip.id, trip.destination);
  res.json({ ok: true });
});

app.delete('/api/trips/:id', function(req, res) {
  var d = load();
  d.itinerary = d.itinerary.filter(function(i) { return i.trip_id !== req.params.id; });
  d.notifications = d.notifications.filter(function(n) { return n.trip_id !== req.params.id; });
  d.messages = d.messages.filter(function(m) { return m.trip_id !== req.params.id; });
  d.trips = d.trips.filter(function(t) { return t.id !== req.params.id; });
  save(d);
  res.json({ ok: true });
});

app.post('/api/trips/:id/itinerary', function(req, res) {
  var d = load();
  var item = { id: genId('itin'), trip_id: req.params.id, day_number: req.body.day_number || 1, time: req.body.time || '', title: req.body.title, type: req.body.type || 'activity', location: req.body.location || '', description: req.body.description || '', created_at: new Date().toISOString() };
  d.itinerary.push(item);
  save(d);
  res.json(item);
});

app.delete('/api/itinerary/:id', function(req, res) {
  var d = load();
  d.itinerary = d.itinerary.filter(function(i) { return i.id !== req.params.id; });
  save(d);
  res.json({ ok: true });
});

app.post('/api/trips/:id/notifications', function(req, res) {
  var d = load();
  var notif = { id: genId('notif'), trip_id: req.params.id, message: req.body.message, type: req.body.type || 'update', code: genCode(), read: false, created_at: new Date().toISOString() };
  d.notifications.push(notif);
  save(d);
  var trip = d.trips.find(function(t) { return t.id === req.params.id; });
  if (trip) {
    var cust = d.customers.find(function(c) { return c.id === trip.customer_id; });
    notifyAdmin('\uD83D\uDD14 Update sent to ' + (cust ? cust.name : 'customer') + ': ' + notif.message);
  }
  res.json({ id: notif.id, code: notif.code });
});

app.get('/api/trips/:id/messages', function(req, res) {
  var d = load();
  res.json(d.messages.filter(function(m) { return m.trip_id === req.params.id; }).sort(function(a, b) { return new Date(a.created_at) - new Date(b.created_at); }));
});

app.post('/api/trips/:id/messages', function(req, res) {
  var d = load();
  var msg = { id: genId('msg'), trip_id: req.params.id, customer_id: req.body.customer_id || '', customer_name: req.body.customer_name || '', message: req.body.message, from_admin: !!req.body.from_admin, created_at: new Date().toISOString() };
  d.messages.push(msg);
  save(d);
  if (!msg.from_admin) {
    notifyAdmin('\uD83D\uDCAC Message from ' + (msg.customer_name || 'customer') + ': ' + msg.message);
  }
  res.json(msg);
});

app.get('/portal', function(req, res) { res.send(portalLoginHTML('')); });

app.post('/portal/login', function(req, res) {
  var code = (req.body.code || '').trim();
  var d = load();
  var customer = d.customers.find(function(c) { return c.access_code === code; });
  if (!customer) return res.send(portalLoginHTML('That code didn\'t work. Try again.'));
  res.redirect('/portal/' + code);
});

app.get('/portal/:code', function(req, res) {
  var d = load();
  var customer = d.customers.find(function(c) { return c.access_code === req.params.code; });
  if (!customer) return res.redirect('/portal');
  var trips = d.trips.filter(function(t) { return t.customer_id === customer.id; });
  res.send(portalWelcomeHTML(customer, trips));
});

app.get('/portal/:code/trip/:tripId', function(req, res) {
  var d = load();
  var customer = d.customers.find(function(c) { return c.access_code === req.params.code; });
  if (!customer) return res.redirect('/portal');
  var trip = d.trips.find(function(t) { return t.id === req.params.tripId && t.customer_id === customer.id; });
  if (!trip) return res.redirect('/portal/' + req.params.code);
  var items = d.itinerary.filter(function(i) { return i.trip_id === trip.id; });
  var notifs = d.notifications.filter(function(n) { return n.trip_id === trip.id; });
  var msgs = d.messages.filter(function(m) { return m.trip_id === trip.id; }).sort(function(a, b) { return new Date(a.created_at) - new Date(b.created_at); });
  res.send(portalTripHTML(customer, trip, items, notifs, msgs));
});

app.post('/portal/:code/trip', function(req, res) {
  var d = load();
  var customer = d.customers.find(function(c) { return c.access_code === req.params.code; });
  if (!customer) return res.redirect('/portal');
  var title = (req.body.title || '').trim();
  if (!title) return res.redirect('/portal/' + req.params.code);
  var t = { id: genId('trip'), customer_id: customer.id, title: title, destination: req.body.destination || '', start_date: req.body.start_date || '', end_date: req.body.end_date || '', status: 'upcoming', notes: '', confirmed: false, created_at: new Date().toISOString() };
  d.trips.push(t);
  save(d);
  if (t.destination) runWebhooks(t.id, t.destination);
  notifyAdmin('\uD83D\uDE80 ' + customer.name + ' created trip: ' + title + ' (' + (t.destination || 'TBD') + ')');
  res.redirect('/portal/' + req.params.code + '/trip/' + t.id);
});

app.post('/portal/:code/trip/:tripId/item', function(req, res) {
  var d = load();
  var customer = d.customers.find(function(c) { return c.access_code === req.params.code; });
  if (!customer) return res.redirect('/portal');
  var trip = d.trips.find(function(t) { return t.id === req.params.tripId && t.customer_id === customer.id; });
  if (!trip) return res.redirect('/portal/' + req.params.code);
  var title = (req.body.title || '').trim();
  if (!title) return res.redirect('/portal/' + req.params.code + '/trip/' + req.params.tripId);
  var item = { id: genId('itin'), trip_id: trip.id, day_number: parseInt(req.body.day_number) || 1, time: req.body.time || '', title: title, type: req.body.type || 'activity', location: req.body.location || '', description: req.body.description || '', created_at: new Date().toISOString() };
  d.itinerary.push(item);
  save(d);
  notifyAdmin('\uD83D\uDCCC ' + customer.name + ' added to ' + trip.title + ': ' + title);
  res.redirect('/portal/' + req.params.code + '/trip/' + req.params.tripId);
});

app.post('/portal/:code/trip/:tripId/message', function(req, res) {
  var d = load();
  var customer = d.customers.find(function(c) { return c.access_code === req.params.code; });
  if (!customer) return res.redirect('/portal');
  var trip = d.trips.find(function(t) { return t.id === req.params.tripId && t.customer_id === customer.id; });
  if (!trip) return res.redirect('/portal/' + req.params.code);
  var message = (req.body.message || '').trim();
  if (!message) return res.redirect('/portal/' + req.params.code + '/trip/' + req.params.tripId);
  d.messages.push({ id: genId('msg'), trip_id: trip.id, customer_id: customer.id, customer_name: customer.name, message: message, from_admin: false, created_at: new Date().toISOString() });
  save(d);
  notifyAdmin('\uD83D\uDCAC ' + customer.name + ' (' + trip.title + '): ' + message);
  res.redirect('/portal/' + req.params.code + '/trip/' + req.params.tripId);
});

app.get('/', function(req, res) { res.send(dashboardHTML()); });
app.get('/admin', function(req, res) { res.send(dashboardHTML()); });

function portalLoginHTML(err) {
  return '<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Joel Journeys</title><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:Segoe UI,sans-serif;background:#0a0f1a;color:#e0e0e0;min-height:100vh;display:flex;align-items:center;justify-content:center}.box{background:linear-gradient(135deg,#0d2137,#1a3a5c);border:1px solid #1e3a5f;border-radius:16px;padding:40px;width:90%;max-width:420px;text-align:center}h1{color:#f0c040;font-size:22px;letter-spacing:2px;margin-bottom:8px}.sub{color:#8ab4f8;font-size:14px;margin-bottom:24px}.field input{width:100%;background:#0a0f1a;color:#f0c040;border:2px solid #1e3a5f;border-radius:12px;padding:16px;font-size:28px;text-align:center;font-weight:700;font-family:monospace;letter-spacing:12px;outline:none}.field input:focus{border-color:#f0c040}button{width:100%;background:#f0c040;color:#0a0f1a;border:none;border-radius:12px;padding:14px;font-size:16px;font-weight:700;cursor:pointer;margin-top:16px}button:hover{background:#ffe066}.err{color:#ff6b6b;font-size:13px;margin-top:12px}</style></head><body><div class="box"><h1>JOEL JOURNEYS</h1><div class="sub">Enter your access code to view your trip</div><form method="POST" action="/portal/login"><div class="field"><input name="code" placeholder="0000" maxlength="4" autofocus></div><button type="submit">View My Trip</button></form>' + (err ? '<div class="err">' + esc(err) + '</div>' : '') + '</div></body></html>';
}

function portalWelcomeHTML(customer, trips) {
  var tripCards = '';
  if (trips.length === 0) {
    tripCards = '<div style="background:#111827;border:1px solid #1e3a5f;border-radius:12px;padding:30px;margin-top:20px"><div style="color:#f0c040;font-size:16px;font-weight:700;margin-bottom:16px;text-align:center">Add Your Trip</div><form method="POST" action="/portal/' + esc(customer.access_code) + '/trip"><div style="margin-bottom:10px"><input name="title" placeholder="Trip name (e.g. Tokyo Adventure)" required style="width:100%;background:#0a0f1a;color:#e0e0e0;border:1px solid #1e3a5f;border-radius:8px;padding:12px 16px;font-size:15px;outline:none;font-family:inherit"></div><div style="margin-bottom:10px"><input name="destination" placeholder="Destination (e.g. Tokyo, Japan)" style="width:100%;background:#0a0f1a;color:#e0e0e0;border:1px solid #1e3a5f;border-radius:8px;padding:12px 16px;font-size:15px;outline:none;font-family:inherit"></div><div style="display:flex;gap:10px;margin-bottom:16px"><input name="start_date" type="date" style="flex:1;background:#0a0f1a;color:#e0e0e0;border:1px solid #1e3a5f;border-radius:8px;padding:12px;font-size:14px;outline:none;font-family:inherit"><input name="end_date" type="date" style="flex:1;background:#0a0f1a;color:#e0e0e0;border:1px solid #1e3a5f;border-radius:8px;padding:12px;font-size:14px;outline:none;font-family:inherit"></div><button type="submit" style="width:100%;background:#f0c040;color:#0a0f1a;border:none;border-radius:10px;padding:14px;font-size:16px;font-weight:700;cursor:pointer">Create Trip</button></form></div>';
  } else {
    tripCards = trips.map(function(t) {
      var bg = t.status === 'active' ? '#1a3a1a;color:#4dff88' : t.status === 'completed' ? '#3a1a3a;color:#ff8aff' : '#1a3a5c;color:#4da6ff';
      return '<a href="/portal/' + esc(customer.access_code) + '/trip/' + esc(t.id) + '" style="display:block;background:#111827;border:1px solid #1e3a5f;border-radius:12px;padding:20px;margin-bottom:12px;text-decoration:none;color:inherit"><div style="display:flex;justify-content:space-between;align-items:center"><div><div style="font-size:18px;font-weight:700;color:#fff">' + esc(t.title) + '</div><div style="font-size:13px;color:#8ab4f8;margin-top:4px">' + esc(t.destination || 'Destination TBD') + ' &middot; ' + (t.start_date || '?') + ' - ' + (t.end_date || '?') + '</div></div><span style="padding:3px 10px;border-radius:10px;font-size:11px;font-weight:600;background:' + bg + '">' + t.status + '</span></div></a>';
    }).join('');
  }
  return '<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Welcome - Joel Journeys</title><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:Segoe UI,sans-serif;background:#0a0f1a;color:#e0e0e0;min-height:100vh}.topbar{background:linear-gradient(135deg,#0d2137,#1a3a5c);padding:24px;border-bottom:2px solid #f0c040;text-align:center}.topbar h1{color:#f0c040;font-size:20px;letter-spacing:2px}.greeting{max-width:700px;margin:30px auto;padding:0 16px;text-align:center}.greeting h2{font-size:22px;color:#fff;margin-bottom:8px}.greeting p{color:#8ab4f8;font-size:15px}.trips{max-width:700px;margin:20px auto;padding:0 16px}</style></head><body><div class="topbar"><h1>JOEL JOURNEYS</h1></div><div class="greeting"><h2>Hey ' + esc(customer.name) + ', welcome!</h2><p>Your travel concierge has everything ready for you below.</p></div><div class="trips">' + tripCards + '</div></body></html>';
}

function portalTripHTML(customer, trip, items, notifs, msgs) {
  var grouped = {};
  items.forEach(function(i) { (grouped[i.day_number] = grouped[i.day_number] || []).push(i); });
  var icons = { flight: '\u2708\uFE0F', hotel: '\uD83C\uDFE8', activity: '\uD83C\uDFAF', restaurant: '\uD83C\uDF7D\uFE0F', transport: '\uD83D\uDE8C', note: '\uD83D\uDCDD' };
  var itinHTML = '';
  if (Object.keys(grouped).length > 0) {
    Object.keys(grouped).forEach(function(day) {
      itinHTML += '<div style="color:#f0c040;font-size:15px;font-weight:600;margin:20px 0 10px">Day ' + day + '</div>';
      grouped[day].forEach(function(e) {
        itinHTML += '<div style="display:flex;gap:12px;padding:14px;background:#111827;border-radius:8px;margin-bottom:8px;border-left:3px solid ' + (e.type === 'flight' ? '#4da6ff' : e.type === 'hotel' ? '#f0c040' : e.type === 'restaurant' ? '#ff8844' : '#1e3a5f') + '"><div style="min-width:50px;color:#8ab4f8;font-size:13px;font-weight:600">' + esc(e.time || 'TBD') + '</div><div style="font-size:20px">' + (icons[e.type] || '\uD83D\uDCCC') + '</div><div style="flex:1"><div style="font-size:15px;color:#fff;font-weight:600">' + esc(e.title) + '</div>' + (e.description ? '<div style="font-size:13px;color:#aaa;margin-top:2px">' + esc(e.description) + '</div>' : '') + (e.location ? '<div style="font-size:12px;color:#4da6ff;margin-top:4px">\uD83D\uDCCD ' + esc(e.location) + '</div>' : '') + '</div></div>';
      });
    });
  } else {
    itinHTML = '<div style="text-align:center;padding:20px;color:#666;font-size:14px">No itinerary yet. Add your first item below!</div>';
  }
  var notifHTML = '';
  notifs.forEach(function(n) {
    var bc = n.type === 'delay' ? '#ff8844' : (n.type === 'alert' || n.type === 'cancel') ? '#ff4d4d' : n.type === 'change' ? '#4da6ff' : '#f0c040';
    notifHTML += '<div style="background:#111827;border-left:3px solid ' + bc + ';border-radius:8px;padding:14px;margin-bottom:10px"><div style="display:flex;justify-content:space-between;margin-bottom:6px"><span style="color:#8ab4f8;font-size:11px;text-transform:uppercase;letter-spacing:1px">' + esc(n.type) + '</span><span style="color:#666;font-size:11px">' + new Date(n.created_at).toLocaleDateString() + '</span></div><div style="font-size:14px;color:#e0e0e0;line-height:1.5">' + esc(n.message) + '</div><div style="font-size:11px;color:#f0c040;margin-top:6px;font-family:monospace">Ref: #' + n.code + '</div></div>';
  });
  var chatHTML = '';
  msgs.forEach(function(m) {
    var isCust = !m.from_admin;
    chatHTML += '<div style="margin-bottom:12px;padding:10px 14px;border-radius:10px;max-width:85%;' + (isCust ? 'background:#1a3a5c;margin-left:auto;border-bottom-right-radius:2px' : 'background:#1a3a1a;border-bottom-left-radius:2px') + '"><div style="display:flex;justify-content:space-between;margin-bottom:4px"><span style="font-size:12px;font-weight:600;color:#f0c040">' + esc(isCust ? customer.name : 'Concierge') + '</span><span style="font-size:11px;color:#666">' + new Date(m.created_at).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'}) + '</span></div><div style="font-size:14px;color:#e0e0e0;line-height:1.5">' + esc(m.message) + '</div></div>';
  });
  var code = esc(customer.access_code);
  var tripId = esc(trip.id);
  var addAction = '/portal/' + code + '/trip/' + tripId + '/item';
  var msgAction = '/portal/' + code + '/trip/' + tripId + '/message';
  var addForm = '<form method="POST" action="' + addAction + '" style="display:flex;flex-direction:column;gap:8px;margin-top:12px"><div style="display:flex;gap:8px"><input name="title" placeholder="What is it?" required style="flex:1;background:#0a0f1a;color:#e0e0e0;border:1px solid #1e3a5f;border-radius:8px;padding:10px 14px;font-size:14px;outline:none"><select name="type" style="background:#0a0f1a;color:#e0e0e0;border:1px solid #1e3a5f;border-radius:8px;padding:10px;font-size:14px;outline:none"><option value="flight">Flight</option><option value="hotel">Hotel</option><option value="activity" selected>Activity</option><option value="restaurant">Restaurant</option><option value="transport">Transport</option><option value="note">Note</option></select></div><div style="display:flex;gap:8px"><input name="day_number" type="number" placeholder="Day #" min="1" value="1" style="width:70px;background:#0a0f1a;color:#e0e0e0;border:1px solid #1e3a5f;border-radius:8px;padding:10px;font-size:14px;outline:none"><input name="time" placeholder="Time (e.g. 14:00)" style="width:140px;background:#0a0f1a;color:#e0e0e0;border:1px solid #1e3a5f;border-radius:8px;padding:10px;font-size:14px;outline:none"><input name="location" placeholder="Location" style="flex:1;background:#0a0f1a;color:#e0e0e0;border:1px solid #1e3a5f;border-radius:8px;padding:10px;font-size:14px;outline:none"></div><input name="description" placeholder="Details (optional)" style="background:#0a0f1a;color:#e0e0e0;border:1px solid #1e3a5f;border-radius:8px;padding:10px 14px;font-size:14px;outline:none"><button type="submit" style="background:#f0c040;color:#0a0f1a;border:none;border-radius:8px;padding:12px;font-weight:700;cursor:pointer;font-size:14px">Add to Itinerary</button></form>';
  var msgForm = '<form method="POST" action="' + msgAction + '" style="display:flex;gap:8px;margin-top:12px"><input name="message" placeholder="Message your concierge..." style="flex:1;background:#0a0f1a;color:#e0e0e0;border:1px solid #1e3a5f;border-radius:8px;padding:10px 14px;font-size:14px;outline:none"><button type="submit" style="background:#f0c040;color:#0a0f1a;border:none;border-radius:8px;padding:10px 16px;font-weight:700;cursor:pointer">Send</button></form>';
  return '<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>' + esc(trip.title) + ' - Joel Journeys</title><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:Segoe UI,sans-serif;background:#0a0f1a;color:#e0e0e0;min-height:100vh}.topbar{background:linear-gradient(135deg,#0d2137,#1a3a5c);padding:16px 20px;border-bottom:2px solid #f0c040;display:flex;justify-content:space-between;align-items:center}.topbar h1{color:#f0c040;font-size:18px;letter-spacing:2px}.topbar a{color:#8ab4f8;text-decoration:none;font-size:13px}.container{max-width:700px;margin:0 auto;padding:16px}h2{color:#fff;font-size:20px;margin-bottom:4px}.meta{color:#8ab4f8;font-size:13px;margin-bottom:20px}.section{margin-bottom:24px}.section h3{color:#f0c040;font-size:15px;margin-bottom:12px;padding-bottom:8px;border-bottom:1px solid #1e3a5f}</style></head><body><div class="topbar"><h1>JOEL JOURNEYS</h1><a href="/portal/' + code + '">All Trips</a></div><div class="container"><h2>' + esc(trip.title) + '</h2><div class="meta">' + esc(trip.destination || 'Destination TBD') + ' &middot; ' + (trip.start_date || '?') + ' to ' + (trip.end_date || '?') + ' &middot; <span style="color:' + (trip.status === 'active' ? '#4dff88' : '#4da6ff') + '">' + trip.status + '</span></div>' + (trip.notes ? '<div style="background:#111827;border-radius:8px;padding:14px;margin-bottom:20px;font-size:14px;color:#aaa;border-left:3px solid #f0c040">' + esc(trip.notes) + '</div>' : '') + '<div class="section"><h3>\uD83D\uDCC5 Itinerary</h3>' + itinHTML + addForm + '</div>' + (notifHTML ? '<div class="section"><h3>\uD83D\uDD14 Updates</h3>' + notifHTML + '</div>' : '') + '<div class="section"><h3>\uD83D\uDCAC Chat</h3>' + chatHTML + msgForm + '</div></div></body></html>';
}

function dashboardHTML() {
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>TripTrack - Admin</title><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:Segoe UI,sans-serif;background:#0a0f1a;color:#e0e0e0;min-height:100vh}.topbar{background:linear-gradient(135deg,#0d2137,#1a3a5c);padding:20px 24px;border-bottom:2px solid #f0c040;display:flex;justify-content:space-between;align-items:center}.topbar h1{color:#f0c040;font-size:22px;letter-spacing:2px}.tabs{display:flex;background:#111827;border-bottom:1px solid #1e3a5f}.tab{padding:12px 24px;cursor:pointer;color:#8ab4f8;border-bottom:2px solid transparent;font-size:14px}.tab.active{color:#f0c040;border-bottom-color:#f0c040}.container{max-width:1100px;margin:20px auto;padding:0 16px}.panel{display:none}.panel.active{display:block}.btn{background:#f0c040;color:#0a0f1a;border:none;border-radius:8px;padding:10px 20px;font-size:14px;font-weight:700;cursor:pointer}.btn:hover{background:#ffe066}.btn.danger{background:#ff4d4d;color:#fff}.btn.small{padding:6px 12px;font-size:12px}.btn.secondary{background:#1e3a5f;color:#8ab4f8}.card{background:#111827;border:1px solid #1e3a5f;border-radius:12px;padding:20px;margin-bottom:16px}.card-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:16px}.field{margin-bottom:10px}.field label{display:block;color:#8ab4f8;font-size:12px;margin-bottom:4px;text-transform:uppercase;letter-spacing:1px}.field input,.field select,.field textarea{width:100%;background:#0a0f1a;color:#e0e0e0;border:1px solid #1e3a5f;border-radius:8px;padding:10px 14px;font-size:14px;outline:none;font-family:inherit}.field input:focus,.field select:focus,.field textarea:focus{border-color:#f0c040}.row2{display:flex;gap:12px}.row2>*{flex:1}.badge{display:inline-block;padding:3px 10px;border-radius:10px;font-size:11px;font-weight:600}.badge.upcoming{background:#1a3a5c;color:#4da6ff}.badge.active{background:#1a3a1a;color:#4dff88}.badge.completed{background:#3a1a3a;color:#ff8aff}</style></head><body><div class="topbar"><h1>TRIPTRACK</h1><span style="color:#8ab4f8;font-size:13px">Admin Dashboard</span></div><div class="tabs"><div class="tab active" onclick="showPanel(\'customers\')">Customers</div><div class="tab" onclick="showPanel(\'trips\')">Trips</div><div class="tab" onclick="showPanel(\'add-customer\')">+ Customer</div></div><div class="container"><div id="panel-customers" class="panel active"><h2 style="margin-bottom:20px">Customers</h2><div id="customer-list" class="card-grid"></div></div><div id="panel-trips" class="panel"><h2 style="margin-bottom:20px">Trips</h2><div id="trip-list" class="card-grid"></div></div><div id="panel-add-customer" class="panel"><div class="card" style="max-width:500px"><h2 style="margin-bottom:16px">Add Customer</h2><div class="field"><label>Name</label><input id="ac-name"></div><div class="field"><label>Email</label><input id="ac-email" type="email"></div><div class="field"><label>Phone</label><input id="ac-phone"></div><button class="btn" onclick="addCustomer()">Create Customer</button></div></div></div><script>function showPanel(n){document.querySelectorAll(".panel").forEach(function(p){p.classList.remove("active")});document.querySelectorAll(".tab").forEach(function(t){t.classList.remove("active")});document.getElementById("panel-"+n).classList.add("active");document.querySelectorAll(".tab").forEach(function(t){if(t.textContent.toLowerCase().indexOf(n)>-1||n==="add-customer"&&t.textContent.indexOf("+")>-1)t.classList.add("active")});if(n==="customers")loadCustomers();if(n==="trips")loadTrips()}async function loadCustomers(){var r=await fetch("/api/customers");var d=await r.json();var h="";d.forEach(function(c){h+="<div class=card><div style=display:flex;justify-content:space-between;align-items:start><div><div style=font-size:16px;font-weight:700;color:#fff>"+c.name+"</div><div style="font-size:13px;color:#8ab4f8;margin-top:4px>"+c.email+"</div><div style="font-size:12px;color:#666;margin-top:4px">Code: <span style=color:#f0c040;font-family:monospace>"+c.access_code+"</span> | Trips: "+c.trip_count+"</div></div><button class=btn danger small onclick=deleteCustomer(\""+c.id+"\")>X</button></div></div>"});document.getElementById("customer-list").innerHTML=h||"<p style=color:#666>No customers yet</p>"}async function loadTrips(){var r=await fetch("/api/trips");var d=await r.json();var h="";d.forEach(function(t){h+="<div class=card><div style=font-size:16px;font-weight:700;color:#fff>"+t.title+"</div><div style=font-size:13px;color:#8ab4f8;margin-top:4px>"+(t.destination||"TBD")+" | "+t.customer_name+"</div><div style=font-size:12px;color:#666;margin-top:4px>"+(t.start_date||"?")+" to "+(t.end_date||"?")+" | <span class=\"badge "+t.status+"">"+t.status+"</span></div><div style=margin-top:8px;font-size:12px><a href=/portal/"+t.customer_email+" style=color:#f0c040>Portal</a></div></div>"});document.getElementById("trip-list").innerHTML=h||"<p style=color:#666>No trips yet</p>"}async function addCustomer(){var n=document.getElementById("ac-name").value;var e=document.getElementById("ac-email").value;var p=document.getElementById("ac-phone").value;if(!n||!e)return alert("Name and email required");await fetch("/api/customers",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({name:n,email:e,phone:p})});document.getElementById("ac-name").value="";document.getElementById("ac-email").value="";document.getElementById("ac-phone").value="";alert("Customer created!");showPanel("customers")}async function deleteCustomer(id){if(!confirm("Delete this customer and all their trips?"))return;await fetch("/api/customers/"+id,{method:"DELETE"});loadCustomers()}loadCustomers();</script></body></html>`;
}

app.listen(PORT, '0.0.0.0', function() { console.log('TripTrack running on http://localhost:' + PORT); });
