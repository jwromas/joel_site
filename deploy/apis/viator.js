const AFF = require('../affiliates');
const API_KEY = process.env.VIATOR_API_KEY || '';
const PARTNER_KEY = process.env.VIATOR_PARTNER_KEY || '';
const BASE = 'https://api.viator.com/partner';

let dealCache = [];
let lastFetch = 0;
const CACHE_TTL = 60 * 60 * 1000;

const TARGETS = [
  'Miami', 'New York City', 'Paris', 'London', 'Dubai',
  'Las Vegas', 'Los Angeles', 'Barcelona', 'Rome', 'Cancun', 'Nassau'
];
const MIN_PRICE = 1;

const SKIP_KEYWORDS = [
  'esim', 'data plan', 'self-guided', 'self guided', 'murder mystery',
  'detective walk', 'puzzle adventure', 'app tour', 'audio stories',
  'shuttle', 'hop-on hop-off', 'sim card', 'roaming'
];

let headers = {
  'exp-api-key': API_KEY,
  'Content-Type': 'application/json',
  'Accept': 'application/json;version=2.0',
  'Accept-Language': 'en-US'
};

async function getDestinations() {
  if (!API_KEY) return [];
  try {
    const res = await fetch(`${BASE}/destinations`, { headers, signal: AbortSignal.timeout(10000) });
    const data = await res.json();
    return data.destinations || data.data || [];
  } catch (e) {
    console.error('Viator destinations:', e.message);
    return [];
  }
}

function findDestIds(all, names) {
  const ids = [];
  for (const name of names) {
    const match = all.find(d => {
      const dn = (d.name || '').toLowerCase();
      const nl = name.toLowerCase();
      return dn === nl || dn.includes(nl) || nl.includes(dn);
    });
    if (match) ids.push({ name: match.name, id: match.destinationId || match.ref || match.id });
  }
  return ids;
}

async function searchProducts(destId) {
  try {
    const res = await fetch(`${BASE}/products/search`, {
      method: 'POST', headers,
      body: JSON.stringify({
        filtering: { destination: destId.toString() },
        sorting: { sort: 'PRICE', order: 'ASCENDING' },
        pagination: { start: 1, count: 5 },
        currency: 'USD'
      }),
      signal: AbortSignal.timeout(8000)
    });
    const data = await res.json();
    return data.products || data.data || [];
  } catch (e) {
    console.error(`Viator search ${destId}:`, e.message);
    return [];
  }
}

function toDeal(product, destName) {
  const rating = product.reviews?.combinedAverageRating;
  const reviews = product.reviews?.totalReviews || 0;
  return {
    title: product.title || 'Tour Experience',
    description: `${(product.description || '').slice(0, 150)} Browse tours and activities on Viator (https://www.viator.com/partner-shop/joel-journeys-vip). Book via joeljourneys.com`,
    price: `From $${Math.round(product.pricing?.summary?.fromPrice || 0)}`,
    origin: 'Any',
    destination: destName || 'Worldwide',
    type: 'Tour',
    category: 'Experience',
    link: AFF.viator.partnerShop,
    affiliateUrl: AFF.viator.partnerShop,
    expires: new Date(Date.now() + 90 * 86400000).toISOString(),
    date: new Date().toISOString()
  };
}

function toFallback(dest) {
  return {
    title: `Tours: ${dest || 'Worldwide'}`,
    description: `Browse tours and activities on Viator (https://www.viator.com/partner-shop/joel-journeys-vip). Book via joeljourneys.com`,
    price: 'Check website',
    type: 'Tour',
    category: 'Experience',
    link: AFF.viator.partnerShop,
    affiliateUrl: AFF.viator.partnerShop,
    expires: new Date(Date.now() + 30 * 86400000).toISOString(),
    date: new Date().toISOString(),
    source: 'concierge'
  };
}

async function findTour(keyword) {
  if (!API_KEY) return toFallback(keyword);
  try {
    const all = await getDestinations();
    if (!all.length) return toFallback(keyword);
    const match = all.find(d => (d.name || '').toLowerCase().includes(keyword.toLowerCase()));
    if (!match) return toFallback(keyword);
    const destId = match.destinationId || match.ref || match.id;
    const products = await searchProducts(destId);
    if (products.length) {
      return toDeal(products[0], match.name);
    }
    return toFallback(match.name);
  } catch (e) {
    return toFallback(keyword);
  }
}

async function fetchDeals() {
  const now = Date.now();
  if (now - lastFetch < CACHE_TTL && dealCache.length) return dealCache;
  if (!API_KEY) {
    console.log('Viator: No API key, using fallback');
    dealCache = [toFallback('Worldwide')];
    lastFetch = now;
    return dealCache;
  }
  const all = await getDestinations();
  if (!all.length) {
    dealCache = [toFallback('Worldwide')];
    lastFetch = now;
    return dealCache;
  }
  const targets = findDestIds(all, TARGETS);
  const results = [];
  for (const t of targets) {
    const products = await searchProducts(t.id);
    for (const p of products) {
      const title = (p.title || '').toLowerCase();
      const desc = (p.description || '').toLowerCase();
      const skip = SKIP_KEYWORDS.some(kw => title.includes(kw) || desc.includes(kw));
      if (skip) continue;
      const price = p.pricing?.summary?.fromPrice;
      if (!price || price < MIN_PRICE) continue;
      results.push(toDeal(p, t.name));
    }
    await new Promise(r => setTimeout(r, 500));
  }
  if (!results.length) {
    dealCache = [toFallback('Worldwide')];
    lastFetch = now;
    console.log('Viator: No tour results, using fallback');
    return dealCache;
  }
  results.sort((a, b) => parseInt(a.price.replace(/\D/g, '')) - parseInt(b.price.replace(/\D/g, '')));
  dealCache = results.slice(0, 20);
  lastFetch = now;
  console.log(`Viator: ${dealCache.length} tour deals cached`);
  return dealCache;
}

// CLI mode
if (require.main === module) {
  const args = process.argv.slice(2);
  if (args.length >= 1) {
    (async () => {
      const result = await findTour(args.join(' '));
      console.log(JSON.stringify(result, null, 2));
    })().catch(e => {
      console.error(JSON.stringify({ error: e.message, fallback: true, link: 'https://joeljourneys.com/' }));
    });
  } else {
    (async () => {
      const deals = await fetchDeals();
      console.log(JSON.stringify(deals, null, 2));
    })();
  }
}

module.exports = { fetchDeals, findTour };