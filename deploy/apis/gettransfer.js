const AFF = require('../affiliates');

const API_TOKEN = process.env.GETTRANSFER_API_KEY || '';
const BASE = 'https://gtrbox.org/api';

const ROUTES = [
  { origin: 'Miami (MIA)', dest: 'South Beach', from: '25.7933,-80.2906', to: '25.7907,-80.1300' },
  { origin: 'New York (JFK)', dest: 'Manhattan', from: '40.6413,-73.7781', to: '40.7580,-73.9855' },
  { origin: 'London (LHR)', dest: 'Central London', from: '51.4700,-0.4543', to: '51.5074,-0.1278' },
  { origin: 'Paris (CDG)', dest: 'Paris City Center', from: '49.0097,2.5479', to: '48.8566,2.3522' },
  { origin: 'Dubai (DXB)', dest: 'Dubai Marina', from: '25.2532,55.3657', to: '25.0804,55.1403' },
  { origin: 'Los Angeles (LAX)', dest: 'Beverly Hills', from: '33.9416,-118.4085', to: '34.0736,-118.4004' },
  { origin: 'Las Vegas (LAS)', dest: 'The Strip', from: '36.0840,-115.1537', to: '36.1147,-115.1728' },
  { origin: 'Nassau (NAS)', dest: 'Paradise Island', from: '25.0390,-77.4662', to: '25.0820,-77.3280' },
  { origin: 'San Juan (SJU)', dest: 'Old San Juan', from: '18.4394,-66.0018', to: '18.4655,-66.1057' },
  { origin: 'Barcelona (BCN)', dest: 'Barcelona Center', from: '41.2974,2.0833', to: '41.3874,2.1686' },
  { origin: 'Rome (FCO)', dest: 'Rome Center', from: '41.8003,12.2389', to: '41.9028,12.4964' },
];

const VEHICLE_MAP = {
  economy: 'Economy Sedan', comfort: 'Comfort Sedan', business: 'Business Sedan',
  premium: 'Premium Sedan', limousine: 'Limousine', suv: 'SUV',
  van: 'Van', business_van: 'Business Van', minibus: 'Minibus', bus: 'Bus'
};

let dealCache = [];
let lastFetch = 0;
const CACHE_TTL = 60 * 60 * 1000;

function tomorrow() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(10, 0, 0, 0);
  const offset = -d.getTimezoneOffset();
  const sign = offset >= 0 ? '+' : '-';
  const pad = n => String(n).padStart(2, '0');
  const h = Math.floor(Math.abs(offset) / 60);
  const m = Math.abs(offset) % 60;
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:00:00${sign}${pad(h)}:${pad(m)}`;
}

async function fetchRoutePrice(route) {
  if (!API_TOKEN) return [];
  const dateTo = tomorrow();
  const url = `${BASE}/route_info?points%5B%5D=${encodeURIComponent(route.from)}&points%5B%5D=${encodeURIComponent(route.to)}&with_prices=true&date_to=${encodeURIComponent(dateTo)}&pax=2&currency=USD`;
  try {
    const res = await fetch(url, {
      headers: { 'X-ACCESS-TOKEN': API_TOKEN, 'Accept': 'application/json' },
      signal: AbortSignal.timeout(10000)
    });
    const data = await res.json();
    if (data.result !== 'success' || !data.data?.prices) return [];
    const prices = data.data.prices;
    const distance = data.data.distance || 0;
    const duration = data.data.duration || 0;
    const deals = [];
    for (const [type, info] of Object.entries(prices)) {
      if (type === 'parcel') continue;
      const price = info.min_float;
      if (!price || price < 1) continue;
      const vehicle = VEHICLE_MAP[type] || type;
      deals.push({
        origin: route.origin,
        dest: route.dest,
        vehicle,
        price,
        desc: `${vehicle} from ${route.origin} to ${route.dest}. ${distance} mi, ~${duration} min drive. Professional driver, flight tracking, free wait. Book via joeljourneys.com`
      });
    }
    return deals;
  } catch (e) {
    console.error(`GetTransfer API ${route.origin}:`, e.message);
    return [];
  }
}

function toDeal(d) {
  return {
    title: `Chauffeur: ${d.origin} → ${d.dest} — ${d.vehicle} from $${d.price}`,
    description: d.desc,
    price: `From $${d.price}`,
    origin: d.origin,
    destination: d.dest,
    type: 'Chauffeur',
    category: d.vehicle,
    link: AFF.getTransfer.url,
    affiliateUrl: AFF.getTransfer.url,
    expires: new Date(Date.now() + 7 * 86400000).toISOString(),
    date: new Date().toISOString(),
    source: 'gettransfer'
  };
}

function toFallback() {
  return {
    title: 'Airport Transfers Worldwide',
    description: 'Book airport transfers and chauffeur services on GetTransfer (https://www.gettransfer.com). Professional drivers, flight tracking, free wait time. Book via joeljourneys.com',
    price: 'From $49',
    type: 'Chauffeur',
    category: 'Transfer',
    link: AFF.getTransfer.url,
    affiliateUrl: AFF.getTransfer.url,
    expires: new Date(Date.now() + 30 * 86400000).toISOString(),
    date: new Date().toISOString(),
    source: 'concierge'
  };
}

async function fetchDeals() {
  const now = Date.now();
  if (now - lastFetch < CACHE_TTL && dealCache.length) return dealCache;
  if (!API_TOKEN) {
    console.log('GetTransfer: No API token - using fallback');
    dealCache = [toFallback()];
    lastFetch = now;
    return dealCache;
  }
  const all = [];
  for (const route of ROUTES) {
    const deals = await fetchRoutePrice(route);
    all.push(...deals);
    await new Promise(r => setTimeout(r, 300));
  }
  if (!all.length) {
    console.log('GetTransfer: No live prices - using fallback');
    dealCache = [toFallback()];
    lastFetch = now;
    return dealCache;
  }
  const mapped = all.map(toDeal);
  mapped.sort((a, b) => parseInt(a.price.replace(/\D/g, '')) - parseInt(b.price.replace(/\D/g, '')));
  dealCache = mapped.slice(0, 30);
  lastFetch = now;
  console.log(`GetTransfer: ${dealCache.length} live deals cached`);
  return dealCache;
}

module.exports = { fetchDeals };
