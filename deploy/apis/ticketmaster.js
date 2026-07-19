const https = require('https');

const AFF = require('../affiliates');
const API_KEY = AFF.ticketmaster.apiKey || process.env.TICKETMASTER_API_KEY || '';
const API_SECRET = AFF.ticketmaster.apiSecret || process.env.TICKETMASTER_API_SECRET || '';

const SEGMENTS = [
  { id: 'KZFzniwnSyZfZ7v7nJ', name: 'Music' },
  { id: 'KZFzniwnSyZfZ7v7nE', name: 'Sports' },
  { id: 'KZFzniwnSyZfZ7v7na', name: 'Arts & Theatre' },
  { id: 'KZFzniwnSyZfZ7v7nn', name: 'Misc' },
];

let dealCache = [];
let lastFetch = 0;
const CACHE_TTL = 60 * 60 * 1000;

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let body = '';
      res.on('data', d => body += d);
      res.on('end', () => {
        try { resolve(JSON.parse(body)); }
        catch (e) { reject(new Error('Parse failed: ' + e.message)); }
      });
    }).on('error', reject);
  });
}

function toDeal(event) {
  const name = event.name || 'Event';
  const date = event.dates?.start?.localDate || 'TBD';
  const venue = event._embedded?.venues?.[0];
  const city = venue?.city?.name || 'Various';
  const state = venue?.state?.stateCode || '';
  const loc = state ? `${city}, ${state}` : city;
  const prices = event.priceRanges;
  let priceStr = 'Check website';
  let minPrice = 99999;
  if (prices && prices.length) {
    const min = Math.min(...prices.map(p => p.min || 99999));
    const max = Math.max(...prices.map(p => p.max || 0));
    minPrice = min;
    priceStr = min === max ? `$${min}` : `$${min}–$${max}`;
  }
  const genres = event.classifications || [];
  const segName = genres[0]?.segment?.name || 'Events';
  return {
    title: `${segName}: ${name} — ${priceStr}`,
    description: `For ${name} tickets browse the official sales on Ticketmaster Live (https://www.ticketmaster.com) or check TicketNetwork Live (https://www.ticketnetwork.com) for a wider range of options. Both platforms offer secure booking and a variety of seating categories. Book via joeljourneys.com`,
    price: priceStr === 'Check website' ? 'Check website' : `From ${priceStr}`,
    origin: loc,
    destination: loc,
    type: 'Tickets',
    category: segName,
    link: AFF.ticketNetwork.url,
    affiliateUrl: AFF.ticketNetwork.url,
    expires: new Date(Date.now() + 30 * 86400000).toISOString(),
    date: new Date().toISOString(),
    source: 'ticketmaster'
  };
}

function toFallback(keyword) {
  return {
    title: `Tickets: ${keyword}`,
    description: `For ${keyword} tickets check TicketNetwork Live (https://www.ticketnetwork.com) for matchday and hospitality options. Secure booking with a variety of seating categories available. Book via joeljourneys.com`,
    price: 'Check website',
    type: 'Tickets',
    category: 'Events',
    link: AFF.ticketNetwork.url,
    affiliateUrl: AFF.ticketNetwork.url,
    expires: new Date(Date.now() + 30 * 86400000).toISOString(),
    date: new Date().toISOString(),
    source: 'concierge'
  };
}

async function fetchDeals() {
  const now = Date.now();
  if (now - lastFetch < CACHE_TTL && dealCache.length) {
    return dealCache;
  }
  if (!API_KEY) {
    console.log('Ticketmaster: No API key configured, using static deals');
    const staticDeals = getStaticDeals();
    dealCache = staticDeals;
    lastFetch = now;
    return dealCache;
  }
  try {
    const allEvents = [];
    for (const seg of SEGMENTS) {
      try {
        const url = `https://app.ticketmaster.com/discovery/v2/events.json?apikey=${API_KEY}&size=10&segmentId=${seg.id}&countryCode=US&sort=date,asc`;
        const data = await fetchJson(url);
        if (data._embedded?.events) {
          allEvents.push(...data._embedded.events);
        }
      } catch (e) {
        console.log(`Ticketmaster: Error fetching ${seg.name}: ${e.message}`);
      }
    }
    if (allEvents.length) {
      allEvents.sort((a, b) => {
        const aDate = a.dates?.start?.localDate || '';
        const bDate = b.dates?.start?.localDate || '';
        return aDate.localeCompare(bDate);
      });
      const deals = allEvents.map(toDeal);
      deals.sort((a, b) => {
        const aP = parseInt(a.price.replace(/\D/g, '')) || 99999;
        const bP = parseInt(b.price.replace(/\D/g, '')) || 99999;
        return aP - bP;
      });
      dealCache = deals.slice(0, 50);
      lastFetch = now;
      console.log(`Ticketmaster: ${dealCache.length} live deals fetched`);
      return dealCache;
    }
    console.log('Ticketmaster: No live events, using static deals');
    const staticDeals = getStaticDeals();
    dealCache = staticDeals;
    lastFetch = now;
    return dealCache;
  } catch (e) {
    console.log(`Ticketmaster: API error (${e.message}), using static deals`);
    const staticDeals = getStaticDeals();
    dealCache = staticDeals;
    lastFetch = now;
    return dealCache;
  }
}

function getStaticDeals() {
  return [
    { title: 'Music: Taylor Swift — The Eras Tour from $499', description: 'For Taylor Swift tickets browse the official sales on Ticketmaster Live (https://www.ticketmaster.com) or check TicketNetwork Live (https://www.ticketnetwork.com) for a wider range of options. Both platforms offer secure booking and a variety of seating categories. Book via joeljourneys.com', price: 'From $499', origin: 'Various Cities', destination: 'Various Cities', type: 'Tickets', category: 'Music',     link: AFF.ticketmaster.url, affiliateUrl: AFF.ticketmaster.url, expires: new Date(Date.now() + 60 * 86400000).toISOString(), date: new Date().toISOString(), source: 'ticketmaster' },
    { title: 'Sports: NBA Finals — from $299', description: 'For NBA Finals tickets browse the official sales on Ticketmaster Live (https://www.ticketmaster.com) or check TicketNetwork Live (https://www.ticketnetwork.com) for a wider range of options. Both platforms offer secure booking and a variety of seating categories. Book via joeljourneys.com', price: 'From $299', origin: 'Various Cities', destination: 'Various Cities', type: 'Tickets', category: 'Sports',     link: AFF.ticketmaster.url, affiliateUrl: AFF.ticketmaster.url, expires: new Date(Date.now() + 60 * 86400000).toISOString(), date: new Date().toISOString(), source: 'ticketmaster' },
    { title: 'Theatre: Broadway Shows — from $89', description: 'For Broadway shows browse the official sales on Ticketmaster Live (https://www.ticketmaster.com) or check TicketNetwork Live (https://www.ticketnetwork.com) for a wider range of options. Both platforms offer secure booking and a variety of seating categories. Book via joeljourneys.com', price: 'From $89', origin: 'New York, NY', destination: 'New York, NY', type: 'Tickets', category: 'Arts & Theatre',     link: AFF.ticketmaster.url, affiliateUrl: AFF.ticketmaster.url, expires: new Date(Date.now() + 60 * 86400000).toISOString(), date: new Date().toISOString(), source: 'ticketmaster' },
    { title: 'Music: Beyoncé — Renaissance Tour from $399', description: 'For Beyoncé tickets browse the official sales on Ticketmaster Live (https://www.ticketmaster.com) or check TicketNetwork Live (https://www.ticketnetwork.com) for a wider range of options. Both platforms offer secure booking and a variety of seating categories. Book via joeljourneys.com', price: 'From $399', origin: 'Various Cities', destination: 'Various Cities', type: 'Tickets', category: 'Music',     link: AFF.ticketmaster.url, affiliateUrl: AFF.ticketmaster.url, expires: new Date(Date.now() + 60 * 86400000).toISOString(), date: new Date().toISOString(), source: 'ticketmaster' },
    { title: 'Sports: NFL Football — from $149', description: 'For NFL tickets browse the official sales on Ticketmaster Live (https://www.ticketmaster.com) or check TicketNetwork Live (https://www.ticketnetwork.com) for a wider range of options. Both platforms offer secure booking and a variety of seating categories. Book via joeljourneys.com', price: 'From $149', origin: 'Various Cities', destination: 'Various Cities', type: 'Tickets', category: 'Sports',     link: AFF.ticketmaster.url, affiliateUrl: AFF.ticketmaster.url, expires: new Date(Date.now() + 60 * 86400000).toISOString(), date: new Date().toISOString(), source: 'ticketmaster' },
    { title: 'Music: Ed Sheeran — Tour from $129', description: 'For Ed Sheeran tickets browse the official sales on Ticketmaster Live (https://www.ticketmaster.com) or check TicketNetwork Live (https://www.ticketnetwork.com) for a wider range of options. Both platforms offer secure booking and a variety of seating categories. Book via joeljourneys.com', price: 'From $129', origin: 'Various Cities', destination: 'Various Cities', type: 'Tickets', category: 'Music',     link: AFF.ticketmaster.url, affiliateUrl: AFF.ticketmaster.url, expires: new Date(Date.now() + 60 * 86400000).toISOString(), date: new Date().toISOString(), source: 'ticketmaster' },
    { title: 'Theatre: Wicked — Broadway from $99', description: 'For Wicked tickets browse the official sales on Ticketmaster Live (https://www.ticketmaster.com) or check TicketNetwork Live (https://www.ticketnetwork.com) for a wider range of options. Both platforms offer secure booking and a variety of seating categories. Book via joeljourneys.com', price: 'From $99', origin: 'New York, NY', destination: 'New York, NY', type: 'Tickets', category: 'Arts & Theatre',     link: AFF.ticketmaster.url, affiliateUrl: AFF.ticketmaster.url, expires: new Date(Date.now() + 60 * 86400000).toISOString(), date: new Date().toISOString(), source: 'ticketmaster' },
    { title: 'Sports: MLB Baseball — from $35', description: 'For MLB tickets browse the official sales on Ticketmaster Live (https://www.ticketmaster.com) or check TicketNetwork Live (https://www.ticketnetwork.com) for a wider range of options. Both platforms offer secure booking and a variety of seating categories. Book via joeljourneys.com', price: 'From $35', origin: 'Various Cities', destination: 'Various Cities', type: 'Tickets', category: 'Sports',     link: AFF.ticketmaster.url, affiliateUrl: AFF.ticketmaster.url, expires: new Date(Date.now() + 60 * 86400000).toISOString(), date: new Date().toISOString(), source: 'ticketmaster' },
    { title: 'Music: Bad Bunny — Tour from $199', description: 'For Bad Bunny tickets browse the official sales on Ticketmaster Live (https://www.ticketmaster.com) or check TicketNetwork Live (https://www.ticketnetwork.com) for a wider range of options. Both platforms offer secure booking and a variety of seating categories. Book via joeljourneys.com', price: 'From $199', origin: 'Various Cities', destination: 'Various Cities', type: 'Tickets', category: 'Music',     link: AFF.ticketmaster.url, affiliateUrl: AFF.ticketmaster.url, expires: new Date(Date.now() + 60 * 86400000).toISOString(), date: new Date().toISOString(), source: 'ticketmaster' },
    { title: 'Arts: Cirque du Soleil — from $79', description: 'For Cirque du Soleil tickets browse the official sales on Ticketmaster Live (https://www.ticketmaster.com) or check TicketNetwork Live (https://www.ticketnetwork.com) for a wider range of options. Both platforms offer secure booking and a variety of seating categories. Book via joeljourneys.com', price: 'From $79', origin: 'Las Vegas, NV', destination: 'Las Vegas, NV', type: 'Tickets', category: 'Arts & Theatre',     link: AFF.ticketmaster.url, affiliateUrl: AFF.ticketmaster.url, expires: new Date(Date.now() + 60 * 86400000).toISOString(), date: new Date().toISOString(), source: 'ticketmaster' },
  ];
}

async function findEvent(keyword) {
  if (!API_KEY) return toFallback(keyword);
  try {
    const url = `https://app.ticketmaster.com/discovery/v2/events.json?apikey=${API_KEY}&size=5&keyword=${encodeURIComponent(keyword)}&countryCode=US&sort=date,asc`;
    const data = await fetchJson(url);
    if (data._embedded?.events?.length) {
      const event = data._embedded.events[0];
      return toDeal(event);
    }
    return toFallback(keyword);
  } catch (e) {
    return toFallback(keyword);
  }
}

// CLI mode
if (require.main === module) {
  const args = process.argv.slice(2);
  if (args.length >= 1) {
    (async () => {
      const result = await findEvent(args.join(' '));
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

module.exports = { fetchDeals, findEvent };