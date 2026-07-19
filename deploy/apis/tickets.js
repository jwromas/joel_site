const AFF = require('../affiliates');

const TICKET_DEALS = [
  { city: 'Las Vegas', event: 'U2: UV Achtung Baby at Sphere', price: 149, desc: 'U2 at Sphere Las Vegas. State-of-the-art venue with immersive video. One of the hottest tickets in Vegas.' },
  { city: 'Las Vegas', event: 'Adele: Weekends with Adele', price: 299, desc: 'Adele residency at The Colosseum at Caesars Palace. Limited engagement. Premium seating available.' },
  { city: 'Las Vegas', event: 'J Balvin at Resorts World', price: 89, desc: 'J Balvin live at Resorts World Las Vegas. High-energy reggaeton show.' },
  { city: 'Las Vegas', event: 'Carrie Underwood: Reflection', price: 75, desc: 'Carrie Underwood residency at Resorts World Theatre. Reflection: The Las Vegas Residency.' },
  { city: 'Miami', event: 'Formula 1 Crypto.com Miami Grand Prix', price: 399, desc: 'F1 Miami Grand Prix at Hard Rock Stadium. 3-day weekend pass. Watch the world\'s fastest drivers.' },
  { city: 'Miami', event: 'Rolling Loud Miami', price: 249, desc: 'Rolling Loud hip-hop festival in Miami. Multi-day pass with top artists.' },
  { city: 'Miami', event: 'Miami Heat Playoff Game', price: 85, desc: 'Miami Heat NBA regular season or playoff tickets at Kaseya Center.' },
  { city: 'New York', event: 'The Lion King on Broadway', price: 89, desc: 'Disney\'s The Lion King at the Minskoff Theatre. The landmark Broadway musical.' },
  { city: 'New York', event: 'Hamilton on Broadway', price: 129, desc: 'Hamilton at the Richard Rodgers Theatre. The Pulitzer-winning musical phenomenon.' },
  { city: 'New York', event: 'NY Yankees at Yankee Stadium', price: 45, desc: 'New York Yankees home game at Yankee Stadium. Premium seating available.' },
  { city: 'New York', event: 'US Open Tennis Championships', price: 95, desc: 'US Open at Arthur Ashe Stadium. Day or evening sessions. See tennis legends compete.' },
  { city: 'Los Angeles', event: 'LA Lakers at Crypto.com Arena', price: 110, desc: 'Los Angeles Lakers basketball game. Watch LeBron and the Lakers at Crypto.com Arena.' },
  { city: 'Los Angeles', event: 'Hollywood Bowl Summer Concert', price: 49, desc: 'Hollywood Bowl summer concert series. Iconic outdoor venue under the stars.' },
  { city: 'Los Angeles', event: 'Coachella Valley Music Festival', price: 549, desc: 'Coachella Weekend 1 or 2 pass. The premier music and arts festival in Indio, CA.' },
  { city: 'Nashville', event: 'CMA Music Festival', price: 299, desc: 'CMA Fest in Nashville. 4-day country music festival with top artists.' },
  { city: 'Nashville', event: 'Grand Ole Opry Show', price: 55, desc: 'Grand Ole Opry at the Opry House in Nashville. The show that made country music famous.' },
  { city: 'Houston', event: 'World Cup Round of 16: Canada vs Morocco', price: 269, desc: 'FIFA World Cup 2026 Round of 16 at NRG Stadium, Houston. Canada faces Morocco in a knockout clash. Best remaining deal in the tournament.' },
  { city: 'Philadelphia', event: 'World Cup Round of 16: Paraguay vs France', price: 575, desc: 'FIFA World Cup 2026 Round of 16 at Lincoln Financial Field, Philadelphia. France takes on Paraguay.' },
  { city: 'New York', event: 'World Cup Round of 16: Brazil vs Norway', price: 1380, desc: 'FIFA World Cup 2026 Round of 16 at MetLife Stadium, NJ. Brazil vs Norway in a massive knockout match.' },
  { city: 'Mexico City', event: 'World Cup Round of 16: Mexico vs England', price: 3393, desc: 'FIFA World Cup 2026 Round of 16 at Estadio Azteca, Mexico City. Host nation Mexico faces England.' },
  { city: 'Dallas', event: 'World Cup Round of 16: Portugal vs Spain', price: 1587, desc: 'FIFA World Cup 2026 Round of 16 at AT&T Stadium, Arlington. Iberian derby in the knockout stage.' },
  { city: 'Seattle', event: 'World Cup Round of 16: USA vs Belgium', price: 1840, desc: 'FIFA World Cup 2026 Round of 16 at Lumen Field, Seattle. Host nation USA vs Belgium for a quarter-final spot.' },
  { city: 'Atlanta', event: 'World Cup Round of 16: Argentina vs Egypt', price: 2206, desc: 'FIFA World Cup 2026 Round of 16 at Mercedes-Benz Stadium, Atlanta. Defending champions Argentina face Egypt.' },
  { city: 'Vancouver', event: 'World Cup Round of 16: Switzerland vs Colombia', price: 913, desc: 'FIFA World Cup 2026 Round of 16 at BC Place, Vancouver. Switzerland vs Colombia.' },
  { city: 'Boston', event: 'World Cup Quarter-final', price: 1725, desc: 'FIFA World Cup 2026 Quarter-final at Gillette Stadium, Foxborough/Boston. One of four quarter-finals.' },
  { city: 'Los Angeles', event: 'World Cup Quarter-final', price: 3220, desc: 'FIFA World Cup 2026 Quarter-final at SoFi Stadium, Los Angeles. Knockout football under the LA lights.' },
  { city: 'Miami', event: 'World Cup Quarter-final', price: 4025, desc: 'FIFA World Cup 2026 Quarter-final at Hard Rock Stadium, Miami Gardens.' },
  { city: 'Kansas City', event: 'World Cup Quarter-final', price: 2703, desc: 'FIFA World Cup 2026 Quarter-final at Arrowhead Stadium, Kansas City.' },
  { city: 'Dallas', event: 'World Cup Semi-final', price: 3449, desc: 'FIFA World Cup 2026 Semi-final at AT&T Stadium, Arlington. One match from the final.' },
  { city: 'Atlanta', event: 'World Cup Semi-final', price: 3565, desc: 'FIFA World Cup 2026 Semi-final at Mercedes-Benz Stadium, Atlanta. A place in the final awaits.' },
  { city: 'Miami', event: 'World Cup Third Place', price: 1799, desc: 'FIFA World Cup 2026 Third Place match at Hard Rock Stadium, Miami. Bronze medal match.' },
  { city: 'New York', event: 'World Cup Final', price: 11960, desc: 'FIFA World Cup 2026 Final at MetLife Stadium, NJ. The biggest match in world football. Witness history.' },
  { city: 'Chicago', event: 'Lollapalooza Chicago', price: 399, desc: 'Lollapalooza 4-day pass at Grant Park. Top rock, hip-hop, and electronic artists.' },
  { city: 'Chicago', event: 'Chicago Cubs at Wrigley Field', price: 40, desc: 'Chicago Cubs home game at historic Wrigley Field. Bleacher or box seats.' },
  { city: 'New Orleans', event: 'New Orleans Jazz & Heritage Festival', price: 85, desc: 'Jazz Fest in New Orleans at the Fair Grounds. Music, food, and culture.' },
  { city: 'New Orleans', event: 'New Orleans Saints Game', price: 65, desc: 'New Orleans Saints NFL game at the Caesars Superdome.' },
  { city: 'London', event: 'Premier League Football Match', price: 120, desc: 'Premier League match at Emirates, Old Trafford, or Anfield. Top-flight English football.' },
  { city: 'London', event: 'Wimbledon Tennis Championships', price: 80, desc: 'Wimbledon grounds pass or Centre Court ticket. The oldest tennis tournament in the world.' },
  { city: 'London', event: 'Les Misérables in West End', price: 55, desc: 'Les Misérables at the Sondheim Theatre. The world\'s longest-running musical.' },
  { city: 'Paris', event: 'Paris Saint-Germain at Parc des Princes', price: 95, desc: 'PSG Ligue 1 match at Parc des Princes. See Mbappé and world-class football.' },
  { city: 'Paris', event: 'Moulin Rouge Cabaret Show', price: 120, desc: 'Moulin Rouge dinner and show in Paris. The iconic French cabaret experience.' },
  { city: 'Barcelona', event: 'FC Barcelona at Camp Nou', price: 110, desc: 'FC Barcelona La Liga match at Spotify Camp Nou. Watch Barça play at home.' },
  { city: 'Barcelona', event: 'Primavera Sound Barcelona', price: 249, desc: 'Primavera Sound festival in Barcelona. Multi-day indie, rock, and electronic music.' },
  { city: 'Dubai', event: 'Dubai Shopping Festival Concerts', price: 75, desc: 'Major concerts during Dubai Shopping Festival. Past headliners include Mariah Carey, Sting, and more.' },
];

let dealCache = [];
let lastFetch = 0;
const CACHE_TTL = 60 * 60 * 1000;

function toDeal(d) {
  const isNew = Math.random() > 0.7;
  const label = isNew ? ' — Hot Ticket' : '';
  return {
    title: `Tickets: ${d.event} — $${d.price}${label}`,
    description: `${d.desc}${isNew ? ' Limited availability — selling fast!' : ''} Book via joeljourneys.com`,
    price: `From $${d.price}`,
    origin: 'Any',
    destination: d.city,
    type: 'Tickets',
    category: 'Events',
    link: AFF.ticketNetwork.url,
    affiliateUrl: AFF.ticketNetwork.url,
    expires: new Date(Date.now() + (isNew ? 3 : 14) * 86400000).toISOString(),
    date: new Date().toISOString(),
    source: 'ticketnetwork'
  };
}

function fetchDeals() {
  const now = Date.now();
  if (now - lastFetch < CACHE_TTL && dealCache.length) {
    return Promise.resolve(dealCache);
  }
  const deals = TICKET_DEALS.map(toDeal);
  deals.sort((a, b) => parseInt(a.price.replace(/\D/g, '')) - parseInt(b.price.replace(/\D/g, '')));
  dealCache = deals;
  lastFetch = now;
  console.log(`TicketNetwork: ${dealCache.length} ticket deals cached`);
  return Promise.resolve(dealCache);
}

module.exports = { fetchDeals };