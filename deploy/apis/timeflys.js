const AFF = require('../affiliates');

const JET_DEALS = [
  { origin: 'Los Angeles (VNY)', dest: 'Las Vegas (LAS)', originName: 'Los Angeles', destName: 'Las Vegas', aircraft: 'Phenom 300', pax: 6, flightTime: '1hr', price: 3500 },
  { origin: 'Los Angeles (VNY)', dest: 'San Francisco (SFO)', originName: 'Los Angeles', destName: 'San Francisco', aircraft: 'Citation CJ4', pax: 7, flightTime: '1hr 15min', price: 4200 },
  { origin: 'New York (TEB)', dest: 'Miami (PBI)', originName: 'New York', destName: 'Miami', aircraft: 'Challenger 350', pax: 8, flightTime: '3hr', price: 18000 },
  { origin: 'New York (TEB)', dest: 'Miami (PBI)', originName: 'New York', destName: 'Miami', aircraft: 'Citation XLS', pax: 7, flightTime: '3hr', price: 14000 },
  { origin: 'London (STN)', dest: 'Paris (LBG)', originName: 'London', destName: 'Paris', aircraft: 'Citation XLS', pax: 8, flightTime: '1hr', price: 5500 },
  { origin: 'London (STN)', dest: 'Nice (NCE)', originName: 'London', destName: 'Nice', aircraft: 'Hawker 900XP', pax: 8, flightTime: '1hr 50min', price: 8500 },
  { origin: 'London (STN)', dest: 'Geneva (GVA)', originName: 'London', destName: 'Geneva', aircraft: 'Citation CJ4', pax: 7, flightTime: '1hr 40min', price: 7500 },
  { origin: 'Dubai (DXB)', dest: 'Maldives (MLE)', originName: 'Dubai', destName: 'Maldives', aircraft: 'Gulfstream G450', pax: 12, flightTime: '4hr', price: 35000 },
  { origin: 'Dubai (DXB)', dest: 'Maldives (MLE)', originName: 'Dubai', destName: 'Maldives', aircraft: 'Bombardier Global 6000', pax: 13, flightTime: '4hr', price: 42000 },
  { origin: 'Miami (MIA)', dest: 'St. Croix (STX)', originName: 'Miami', destName: 'St. Croix', aircraft: 'Citation XLS', pax: 7, flightTime: '2.5hr', price: 16000 },
  { origin: 'Miami (MIA)', dest: 'St. Croix (STX)', originName: 'Miami', destName: 'St. Croix', aircraft: 'Hawker 900XP', pax: 8, flightTime: '2.5hr', price: 19500 },
  { origin: 'New York (TEB)', dest: 'St. Croix (STX)', originName: 'New York', destName: 'St. Croix', aircraft: 'Falcon 50EX', pax: 9, flightTime: '3.5hr', price: 31500 },
  { origin: 'Miami (MIA)', dest: 'San Juan (SJU)', originName: 'Miami', destName: 'San Juan', aircraft: 'Citation XLS', pax: 7, flightTime: '2.5hr', price: 14000 },
  { origin: 'Miami (MIA)', dest: 'San Juan (SJU)', originName: 'Miami', destName: 'San Juan', aircraft: 'Phenom 300', pax: 6, flightTime: '2.5hr', price: 12500 },
  { origin: 'New York (TEB)', dest: 'San Juan (SJU)', originName: 'New York', destName: 'San Juan', aircraft: 'Falcon 50EX', pax: 9, flightTime: '3.5hr', price: 30000 },
  { origin: 'New York (TEB)', dest: 'Nantucket (ACK)', originName: 'New York', destName: 'Nantucket', aircraft: 'Phenom 300', pax: 6, flightTime: '1hr', price: 6500 },
  { origin: 'New York (TEB)', dest: 'Aspen (ASE)', originName: 'New York', destName: 'Aspen', aircraft: 'Citation XLS', pax: 7, flightTime: '4hr', price: 22000 },
  { origin: 'Los Angeles (VNY)', dest: 'Aspen (ASE)', originName: 'Los Angeles', destName: 'Aspen', aircraft: 'Challenger 350', pax: 8, flightTime: '2hr', price: 18000 },
  { origin: 'Los Angeles (VNY)', dest: 'Cabos (SJD)', originName: 'Los Angeles', destName: 'Cabo San Lucas', aircraft: 'Citation CJ4', pax: 7, flightTime: '2hr', price: 11000 },
  { origin: 'Miami (MIA)', dest: 'Nassau (NAS)', originName: 'Miami', destName: 'Nassau', aircraft: 'Phenom 300', pax: 6, flightTime: '45min', price: 5500 },
  { origin: 'Miami (MIA)', dest: 'Cancun (CUN)', originName: 'Miami', destName: 'Cancun', aircraft: 'Citation XLS', pax: 7, flightTime: '1.5hr', price: 9500 },
  { origin: 'New York (TEB)', dest: 'London (STN)', originName: 'New York', destName: 'London', aircraft: 'Gulfstream G650', pax: 14, flightTime: '6hr', price: 65000 },
  { origin: 'New York (TEB)', dest: 'Paris (LBG)', originName: 'New York', destName: 'Paris', aircraft: 'Bombardier Global 6000', pax: 13, flightTime: '6.5hr', price: 58000 },
  { origin: 'Miami (MIA)', dest: 'Paris (LBG)', originName: 'Miami', destName: 'Paris', aircraft: 'Gulfstream G550', pax: 14, flightTime: '7.5hr', price: 55000 },
  { origin: 'Los Angeles (VNY)', dest: 'Honolulu (HNL)', originName: 'Los Angeles', destName: 'Honolulu', aircraft: 'Gulfstream G650', pax: 14, flightTime: '5.5hr', price: 45000 },
  { origin: 'Dubai (DXB)', dest: 'London (STN)', originName: 'Dubai', destName: 'London', aircraft: 'Bombardier Global 7500', pax: 16, flightTime: '7hr', price: 75000 },
  { origin: 'Dubai (DXB)', dest: 'Geneva (GVA)', originName: 'Dubai', destName: 'Geneva', aircraft: 'Gulfstream G650', pax: 14, flightTime: '6hr', price: 68000 },
  { origin: 'Singapore (SIN)', dest: 'Maldives (MLE)', originName: 'Singapore', destName: 'Maldives', aircraft: 'Bombardier Global 6000', pax: 13, flightTime: '4.5hr', price: 38000 },
  { origin: 'Tokyo (NRT)', dest: 'Singapore (SIN)', originName: 'Tokyo', destName: 'Singapore', aircraft: 'Gulfstream G550', pax: 14, flightTime: '6.5hr', price: 52000 },
  { origin: 'Miami (MIA)', dest: 'Ibiza (IBZ)', originName: 'Miami', destName: 'Ibiza', aircraft: 'Gulfstream G650', pax: 14, flightTime: '7.5hr', price: 62000 },
];

let dealCache = [];
let lastFetch = 0;
const CACHE_TTL = 60 * 60 * 1000;

function toDeal(d) {
  const isNew = Math.random() > 0.65;
  const label = isNew ? ' — Hot Deal' : '';
  return {
    title: `Private Jet: ${d.originName} → ${d.destName} — ${d.aircraft} from $${d.price.toLocaleString()}${label}`,
    description: `Charter a ${d.aircraft} from ${d.originName} to ${d.destName}. ${d.pax} passengers, ${d.flightTime} flight, luxury cabin${isNew ? ' — limited availability.' : ', flexible scheduling.'} Book via TimeFlys (https://www.timeflys.co). Book via joeljourneys.com`,
    price: `From $${d.price.toLocaleString()}`,
    origin: d.origin,
    destination: d.dest,
    type: 'Private Jet',
    category: 'Charter',
    link: AFF.timeFlys.url,
    affiliateUrl: AFF.timeFlys.url,
    expires: new Date(Date.now() + (isNew ? 7 : 30) * 86400000).toISOString(),
    date: new Date().toISOString(),
    source: 'timeflys'
  };
}

function fetchDeals() {
  const now = Date.now();
  if (now - lastFetch < CACHE_TTL && dealCache.length) {
    return Promise.resolve(dealCache);
  }
  const deals = JET_DEALS.map(toDeal);
  deals.sort((a, b) => parseInt(a.price.replace(/\D/g, '')) - parseInt(b.price.replace(/\D/g, '')));
  dealCache = deals;
  lastFetch = now;
  console.log(`TimeFlys: ${dealCache.length} jet deals cached`);
  return Promise.resolve(dealCache);
}

module.exports = { fetchDeals };
