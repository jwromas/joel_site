const AFF = require('../affiliates');

const PLANS = [
  { name: 'Global eSIM 500MB', data: '500MB', validity: '7 days', price: 2.99, region: 'Global', desc: 'Perfect for weekend trips. Instant activation, no roaming fees. Covers 190+ countries.' },
  { name: 'Global eSIM 1GB', data: '1GB', validity: '7 days', price: 4.99, region: 'Global', desc: 'Light data for maps, messages, and emails. 190+ countries. Instant eSIM delivery.' },
  { name: 'Global eSIM 3GB', data: '3GB', validity: '15 days', price: 12.99, region: 'Global', desc: 'Ideal for short trips. Social media, navigation, and browsing. 190+ countries.' },
  { name: 'Global eSIM 5GB', data: '5GB', validity: '30 days', price: 19.99, region: 'Global', desc: 'Best for week-long vacations. Stream, browse, and share. 190+ countries.' },
  { name: 'Global eSIM 10GB', data: '10GB', validity: '30 days', price: 29.99, region: 'Global', desc: 'Heavy data for streaming and video calls. 190+ countries. Promo: JOELSKY.' },
  { name: 'Global eSIM 20GB', data: '20GB', validity: '30 days', price: 39.99, region: 'Global', desc: 'For power users. HD streaming, video calls, and more. 190+ countries. Promo: JOELSKY.' },
  { name: 'Global eSIM Unlimited', data: 'Unlimited', validity: '7 days', price: 49.99, region: 'Global', desc: 'Unlimited high-speed data. No throttling. 190+ countries. Best for digital nomads.' },
  { name: 'Regional eSIM Europe 1GB', data: '1GB', validity: '7 days', price: 5.99, region: 'Europe', desc: 'Stay connected across Europe. 42 countries. Free trial available for 500MB.' },
  { name: 'Regional eSIM Europe 5GB', data: '5GB', validity: '30 days', price: 24.99, region: 'Europe', desc: 'Europe-wide data. 42 countries. Great for multi-city trips. Promo code: JOELSKY.' },
  { name: 'Regional eSIM Caribbean 1GB', data: '1GB', validity: '7 days', price: 7.99, region: 'Caribbean', desc: 'Caribbean coverage. Perfect for cruise stops and island hopping.' },
  { name: 'Regional eSIM Caribbean 5GB', data: '5GB', validity: '30 days', price: 24.99, region: 'Caribbean', desc: 'Explore the islands with fast data. Multiple carrier partners for best signal.' },
  { name: 'Regional eSIM Asia 1GB', data: '1GB', validity: '7 days', price: 5.99, region: 'Asia', desc: 'Coverage across Asia including Japan, Korea, Thailand, and more.' },
  { name: 'Regional eSIM Asia 5GB', data: '5GB', validity: '30 days', price: 24.99, region: 'Asia', desc: 'Full Asia coverage. Ideal for backpacking or business trips across multiple countries.' },
  { name: 'USA eSIM 1GB', data: '1GB', validity: '7 days', price: 4.99, region: 'United States', desc: 'US-only plan. Fast LTE/5G. Great for international visitors to the USA.' },
  { name: 'USA eSIM 5GB', data: '5GB', validity: '30 days', price: 19.99, region: 'United States', desc: 'US travel data. Reliable coverage across all 50 states. Promo: JOELSKY.' },
  { name: 'Cruise eSIM 1GB', data: '1GB', validity: '7 days', price: 19.99, region: 'Cruise Ships', desc: 'Stay connected at sea. Works on 200+ cruise ships. Maritime network coverage.' },
  { name: 'Cruise eSIM 3GB', data: '3GB', validity: '15 days', price: 39.99, region: 'Cruise Ships', desc: 'Cruise data for longer voyages. Social media, email, and browsing at sea.' },
  { name: 'Cruise eSIM 5GB', data: '5GB', validity: '30 days', price: 49.99, region: 'Cruise Ships', desc: 'Heavy cruise data. Stay connected throughout your entire cruise vacation.' },
];

let dealCache = [];
let lastFetch = 0;
const CACHE_TTL = 60 * 60 * 1000;

function toDeal(p) {
  return {
    title: `GigSky eSIM: ${p.name} — $${p.price}`,
    description: `${p.data} · ${p.validity} · ${p.region}. ${p.desc} Use code JOELSKY for 10% off. Book via joeljourneys.com`,
    price: `From $${p.price}`,
    origin: 'Global',
    destination: p.region,
    type: 'eSIM',
    category: 'Connectivity',
    link: AFF.gigsky.url,
    affiliateUrl: AFF.gigsky.url,
    expires: new Date(Date.now() + 30 * 86400000).toISOString(),
    date: new Date().toISOString(),
    source: 'gigsky'
  };
}

function fetchDeals() {
  const now = Date.now();
  if (now - lastFetch < CACHE_TTL && dealCache.length) {
    return Promise.resolve(dealCache);
  }
  const deals = PLANS.map(toDeal);
  deals.sort((a, b) => parseInt(a.price.replace(/\D/g, '')) - parseInt(b.price.replace(/\D/g, '')));
  dealCache = deals;
  lastFetch = now;
  console.log(`GigSky: ${dealCache.length} eSIM plans cached`);
  return Promise.resolve(dealCache);
}

module.exports = { fetchDeals };
