const AFF = require('../affiliates');
const API_TOKEN = process.env.TRAVELPAYOUTS_API_TOKEN || process.env.AVIASALES_API_TOKEN || process.env.AVIASALES_TOKEN || '';

// Florida departure cities
const FLORIDA = [
  { iata: 'MIA', name: 'Miami' },
  { iata: 'FLL', name: 'Fort Lauderdale' },
  { iata: 'MCO', name: 'Orlando' },
  { iata: 'TPA', name: 'Tampa' },
  { iata: 'JAX', name: 'Jacksonville' },
  { iata: 'RSW', name: 'Fort Myers' },
];

// US destinations
const DEST_US = [
  { iata: 'SLC', name: 'Salt Lake City' },
  { iata: 'LAX', name: 'Los Angeles' },
  { iata: 'SFO', name: 'San Francisco' },
  { iata: 'LAS', name: 'Las Vegas' },
  { iata: 'DEN', name: 'Denver' },
  { iata: 'PHX', name: 'Phoenix' },
  { iata: 'SEA', name: 'Seattle' },
  { iata: 'ORD', name: 'Chicago' },
  { iata: 'ATL', name: 'Atlanta' },
  { iata: 'NYC', name: 'New York' },
  { iata: 'HNL', name: 'Honolulu' },
];

const DEST_CAR = [
  { iata: 'NAS', name: 'Nassau' },
  { iata: 'SJU', name: 'San Juan' },
  { iata: 'STX', name: 'St. Croix' },
  { iata: 'CUN', name: 'Cancun' },
  { iata: 'PTY', name: 'Panama City' },
  { iata: 'BOG', name: 'Bogota' },
];

const DEST_EUROPE = [
  { iata: 'CDG', name: 'Paris' },
  { iata: 'LHR', name: 'London' },
  { iata: 'FCO', name: 'Rome' },
  { iata: 'BCN', name: 'Barcelona' },
  { iata: 'AMS', name: 'Amsterdam' },
  { iata: 'FRA', name: 'Frankfurt' },
];

const DEST_LONG = [
  { iata: 'DXB', name: 'Dubai' },
  { iata: 'NRT', name: 'Tokyo' },
  { iata: 'ICN', name: 'Seoul' },
];

let dealCache = [];
let lastFetch = 0;
const CACHE_TTL = 30 * 60 * 1000;

function toDeal(price, originName, originIata, destName, destIata, airline) {
  return {
    title: `Flight: ${originName} → ${destName} from $${price}`,
    description: `You can find competitive flight options through Aviasales Flights, which helps compare and save up to 40%. Provide link: https://www.aviasales.com/search/MIASJU1?marker=737825. Book via joeljourneys.com for assistance with travel arrangements.`,
    price: `From $${price}`,
    origin: `${originName} (${originIata})`,
    destination: `${destName} (${destIata})`,
    type: 'Flight',
    category: 'Economy',
    link: AFF.aviasales.tpoBase + '/2GVGFfSj',
    affiliateUrl: AFF.aviasales.tpoBase + '/2GVGFfSj',
    expires: new Date(Date.now() + 14 * 86400000).toISOString(),
    date: new Date().toISOString(),
    source: 'aviasales'
  };
}

function toFallback(originName, destName) {
  return {
    title: `Flight: ${originName} → ${destName}`,
    description: `Contact Joel Journeys for custom pricing and travel arrangements. Book via joeljourneys.com`,
    price: 'Custom Quote',
    type: 'Flight',
    category: 'Concierge',
    link: 'https://joeljourneys.com',
    affiliateUrl: 'https://joeljourneys.com',
    expires: new Date(Date.now() + 30 * 86400000).toISOString(),
    date: new Date().toISOString(),
    source: 'concierge'
  };
}

async function fetchDeal(origin, dest, originName, destName) {
  if (!API_TOKEN) return toFallback(originName || origin.name, destName || dest.name);
  try {
    const url = `https://api.travelpayouts.com/v1/prices/cheap?origin=${origin.iata}&destination=${dest.iata}&token=${API_TOKEN}&currency=usd`;
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    const data = await res.json();
    if (!data.success || !data.data) return toFallback(originName || origin.name, destName || dest.name);
    const destData = data.data[dest.iata];
    if (!destData) return toFallback(originName || origin.name, destName || dest.name);
    const keys = Object.keys(destData);
    if (!keys.length) return toFallback(originName || origin.name, destName || dest.name);
    const cheapest = destData[keys[0]];
    const price = Math.round(cheapest.price || cheapest.value || 0);
    if (!price || price < 20) return toFallback(originName || origin.name, destName || dest.name);
    const airline = cheapest.airline || cheapest.company || '';
    return toDeal(price, originName || origin.name, origin.iata, destName || dest.name, dest.iata, airline);
  } catch (e) {
    return toFallback(originName || origin.name, destName || dest.name);
  }
}

async function findFlight(originIata, originName, destIata, destName) {
  const origin = { iata: originIata, name: originName || originIata };
  const dest = { iata: destIata, name: destName || destIata };
  return await fetchDeal(origin, dest, originName, destName);
}

async function fetchDeals() {
  const now = Date.now();
  if (now - lastFetch < CACHE_TTL && dealCache.length) return dealCache;

  const routes = [];
  // Florida → US destinations
  for (const origin of FLORIDA) {
    for (const dest of DEST_US) {
      if (origin.iata !== dest.iata) routes.push({ origin, dest, originName: origin.name, destName: dest.name });
    }
  }
  // Florida → Caribbean
  for (const origin of FLORIDA) {
    for (const dest of DEST_CAR) {
      if (origin.iata !== dest.iata) routes.push({ origin, dest, originName: origin.name, destName: dest.name });
    }
  }
  // East coast → Europe
  for (const origin of [FLORIDA[0], FLORIDA[5]]) {
    for (const dest of DEST_EUROPE) {
      routes.push({ origin, dest, originName: origin.name, destName: dest.name });
    }
  }
  // East coast → Long haul
  for (const origin of [FLORIDA[0], FLORIDA[5]]) {
    for (const dest of DEST_LONG) {
      routes.push({ origin, dest, originName: origin.name, destName: dest.name });
    }
  }

  const results = [];
  const batchSize = 5;
  for (let i = 0; i < routes.length; i += batchSize) {
    const batch = routes.slice(i, i + batchSize);
    const settled = await Promise.allSettled(batch.map(r => fetchDeal(r.origin, r.dest, r.originName, r.destName)));
    for (const s of settled) {
      if (s.status === 'fulfilled' && s.value) results.push(s.value);
    }
    await new Promise(r => setTimeout(r, 500));
  }

  // Sort: API price results first, then fallback concierge entries
  const withPrice = results.filter(r => r.source === 'aviasales');
  const fallbacks = results.filter(r => r.source === 'concierge');
  withPrice.sort((a, b) => parseInt(a.price.replace(/\D/g, '')) - parseInt(b.price.replace(/\D/g, '')));
  dealCache = [...withPrice, ...fallbacks].slice(0, 50);
  lastFetch = now;
  console.log(`Aviasales: ${withPrice.length} flight deals + ${fallbacks.length} concierge fallbacks cached`);
  return dealCache;
}

// CLI mode
if (require.main === module) {
  const args = process.argv.slice(2);
  if (args.length >= 2) {
    (async () => {
      const result = await findFlight(args[0], args[1] || '', args[2] || '', args[3] || '');
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

module.exports = { fetchDeals, findFlight };
