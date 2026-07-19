const AFF = require('../affiliates');
const API_TOKEN = process.env.TRAVELPAYOUTS_API_TOKEN || process.env.AVIASALES_API_TOKEN || process.env.AVIASALES_TOKEN || '';
const HOTELLOOK_BASE = 'https://api.travelpayouts.com/hotellook/v2';

const CITIES = [
  { city: 'Miami', region: 'Miami, FL', country: 'USA' },
  { city: 'Paris', region: 'Paris', country: 'France' },
  { city: 'London', region: 'London', country: 'UK' },
  { city: 'New York', region: 'New York, NY', country: 'USA' },
  { city: 'Las Vegas', region: 'Las Vegas, NV', country: 'USA' },
  { city: 'Dubai', region: 'Dubai', country: 'UAE' },
  { city: 'Cancun', region: 'Cancun', country: 'Mexico' },
  { city: 'Tokyo', region: 'Tokyo', country: 'Japan' },
  { city: 'Barcelona', region: 'Barcelona', country: 'Spain' },
  { city: 'Nassau', region: 'Nassau', country: 'Bahamas' },
  { city: 'Los Angeles', region: 'Los Angeles, CA', country: 'USA' },
  { city: 'Bangkok', region: 'Bangkok', country: 'Thailand' },
];

let dealCache = [];
let lastFetch = 0;
const CACHE_TTL = 60 * 60 * 1000;

function guessPrice(cityName) {
  const prices = {
    'Miami': 89, 'Paris': 120, 'London': 110, 'New York': 150,
    'Las Vegas': 65, 'Dubai': 95, 'Cancun': 55, 'Tokyo': 100,
    'Barcelona': 80, 'Nassau': 120, 'Los Angeles': 99, 'Bangkok': 35,
  };
  return prices[cityName] || 79;
}

function hotelSearchUrl() {
  return AFF.mavelyHotel.url;
}

async function lookupCityId(query) {
  try {
    const url = `${HOTELLOOK_BASE}/lookup?token=${API_TOKEN}&query=${encodeURIComponent(query)}&lang=en`;
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    const data = await res.json();
    if (data.results?.hotels?.length) {
      return data.results.hotels.slice(0, 3).map(h => ({ id: h.id, name: h.name, stars: h.stars }));
    }
  } catch (_) {}
  return null;
}

async function fetchHotelPrices(hotelId, checkIn, checkOut) {
  try {
    const url = `${HOTELLOOK_BASE}/search/hotel?token=${API_TOKEN}&currency=usd&checkIn=${checkIn}&checkOut=${checkOut}&adults=2&hotelId=${hotelId}&limit=3`;
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    const data = await res.json();
    return data.results?.rooms?.[0]?.price || null;
  } catch (_) {
    return null;
  }
}

async function fetchDeals() {
  if (!API_TOKEN) return [];
  const now = Date.now();
  if (now - lastFetch < CACHE_TTL && dealCache.length) return dealCache;

  const results = [];
  const checkIn = new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0];
  const checkOut = new Date(Date.now() + 17 * 86400000).toISOString().split('T')[0];

  for (const city of CITIES) {
    try {
      const hotels = await lookupCityId(city.city);
      if (hotels && hotels.length) {
        for (const hotel of hotels) {
          const price = await fetchHotelPrices(hotel.id, checkIn, checkOut);
          const displayPrice = price ? `From $${Math.round(price)}/night` : `From $${guessPrice(city.city)}/night`;
          const stars = '*'.repeat(hotel.stars || 3);
          results.push({
            title: `${stars} ${hotel.name} — ${city.city}, ${city.country}`,
            description: `Book ${hotel.name} in ${city.region}. ${price ? `From $${Math.round(price)}/night. ` : ''}Compare hotel rates on Aviasales (https://www.aviasales.com/search/MIASJU1?marker=737825). Book via joeljourneys.com`,
            price: displayPrice,
            origin: 'Any',
            destination: `${city.city}, ${city.country}`,
            type: 'Hotels',
            category: 'Hotels',
            link: hotelSearchUrl(city.city, AFF.aviasales.marker),
            affiliateUrl: hotelSearchUrl(city.city, AFF.aviasales.marker),
            expires: new Date(Date.now() + 14 * 86400000).toISOString(),
            date: new Date().toISOString(),
            source: 'aviasales'
          });
          await new Promise(r => setTimeout(r, 200));
        }
      }
    } catch (_) {}
    await new Promise(r => setTimeout(r, 300));
  }

  if (!results.length) {
    for (const city of CITIES) {
      const price = guessPrice(city.city);
      results.push({
        title: `Hotels: ${city.city}, ${city.country} — from $${price}/night`,
        description: `Find the best hotel deals in ${city.city}. Compare rates on Aviasales (https://www.aviasales.com/search/MIASJU1?marker=737825). Book via joeljourneys.com`,
        price: `From $${price}/night`,
        origin: 'Any',
        destination: `${city.city}, ${city.country}`,
        type: 'Hotels',
        category: 'Hotels',
        link: hotelSearchUrl(city.city, AFF.aviasales.marker),
        affiliateUrl: hotelSearchUrl(city.city, AFF.aviasales.marker),
        expires: new Date(Date.now() + 30 * 86400000).toISOString(),
        date: new Date().toISOString(),
        source: 'aviasales'
      });
    }
  }

  results.sort((a, b) => {
    const pa = parseInt(a.price.replace(/\D/g, ''));
    const pb = parseInt(b.price.replace(/\D/g, ''));
    return pa - pb;
  });
  dealCache = results.slice(0, 20);
  lastFetch = now;
  console.log(`Hotels: ${dealCache.length} deals cached ${results.length ? '(live)' : '(fallback prices)'}`);
  return dealCache;
}

module.exports = { fetchDeals };
