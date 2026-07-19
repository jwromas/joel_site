const AFF = require('../affiliates');

const RENTAL_DEALS = [
  { origin: 'Miami (MIA)', dest: 'Miami, FL', originName: 'Miami', destName: 'Miami', price: 18, car: 'Economy', desc: 'Enterprise, Hertz, Thrifty — all major brands. Free cancellation, unlimited mileage available.' },
  { origin: 'Orlando (MCO)', dest: 'Orlando, FL', originName: 'Orlando', destName: 'Orlando', price: 15, car: 'Economy', desc: 'Pick up at MCO. Compact car from major brands. Perfect for theme park trips. Free cancellation.' },
  { origin: 'Los Angeles (LAX)', dest: 'Los Angeles, CA', originName: 'Los Angeles', destName: 'Los Angeles', price: 22, car: 'Compact', desc: 'Book a car in LA from LAX. Ideal for PCH road trips. Compare Enterprise, Hertz, Avis.' },
  { origin: 'Los Angeles (LAX)', dest: 'Los Angeles, CA', originName: 'Los Angeles', destName: 'Los Angeles', price: 45, car: 'SUV', desc: 'SUV rental in LA. Perfect for California road trips. Free cancellation.' },
  { origin: 'New York (JFK)', dest: 'New York, NY', originName: 'New York', destName: 'New York', price: 28, car: 'Compact', desc: 'Car rental in NYC from JFK or LGA. Best rates on economy and compact cars. Unlimited mileage options.' },
  { origin: 'New York (JFK)', dest: 'New York, NY', originName: 'New York', destName: 'New York', price: 55, car: 'SUV', desc: 'SUV or minivan rental in NYC. Perfect for family trips. Free cancellation, full insurance.' },
  { origin: 'London (LHR)', dest: 'London, UK', originName: 'London', destName: 'London', price: 22, car: 'Compact', desc: 'Hire a car in London from LHR or LGW. Free cancellation, unlimited mileage, full insurance. Best UK deals.' },
  { origin: 'Paris (CDG)', dest: 'Paris, France', originName: 'Paris', destName: 'Paris', price: 25, car: 'Compact', desc: 'Car rental in Paris from CDG. Manual & automatic options. Compare Europcar, Sixt, Hertz.' },
  { origin: 'Las Vegas (LAS)', dest: 'Las Vegas, NV', originName: 'Las Vegas', destName: 'Las Vegas', price: 12, car: 'Economy', desc: 'Cheap car rental in Las Vegas from $12/day. Pick up at LAS. Ideal for Grand Canyon road trips.' },
  { origin: 'Las Vegas (LAS)', dest: 'Las Vegas, NV', originName: 'Las Vegas', destName: 'Las Vegas', price: 35, car: 'Convertible', desc: 'Convertible rental in Vegas. Cruise the Strip in style. Mustang, Camaro, or similar. Free cancellation.' },
  { origin: 'San Francisco (SFO)', dest: 'San Francisco, CA', originName: 'San Francisco', destName: 'San Francisco', price: 20, car: 'Compact', desc: 'Car rental in San Francisco from SFO. Compact cars from $20/day. Drive to Napa, Yosemite, or Big Sur.' },
  { origin: 'Chicago (ORD)', dest: 'Chicago, IL', originName: 'Chicago', destName: 'Chicago', price: 19, car: 'Economy', desc: 'Car rental in Chicago from ORD or MDW. Economy cars from $19/day. Compare all major brands.' },
  { origin: 'Barcelona (BCN)', dest: 'Barcelona, Spain', originName: 'Barcelona', destName: 'Barcelona', price: 16, car: 'Economy', desc: 'Car hire in Barcelona from BCN. Drive the Costa Brava. Manual transmission, free cancellation.' },
  { origin: 'Rome (FCO)', dest: 'Rome, Italy', originName: 'Rome', destName: 'Rome', price: 18, car: 'Economy', desc: 'Rent a car in Rome from FCO or CIA. Explore Tuscany and Amalfi Coast. Best rates.' },
  { origin: 'Dubai (DXB)', dest: 'Dubai, UAE', originName: 'Dubai', destName: 'Dubai', price: 22, car: 'Compact', desc: 'Car rental in Dubai from DXB. Compact to luxury options available. Drive to Abu Dhabi in comfort.' },
  { origin: 'Dubai (DXB)', dest: 'Dubai, UAE', originName: 'Dubai', destName: 'Dubai', price: 89, car: 'Luxury', desc: 'Luxury car rental in Dubai. Mercedes, BMW, Range Rover. Make an entrance.' },
  { origin: 'Nassau (NAS)', dest: 'Nassau, Bahamas', originName: 'Nassau', destName: 'Nassau', price: 35, car: 'SUV', desc: 'Car rental in Nassau. SUV recommended for island exploration. Free cancellation, full coverage.' },
  { origin: 'Cancun (CUN)', dest: 'Cancun, Mexico', originName: 'Cancun', destName: 'Cancun', price: 14, car: 'Economy', desc: 'Car rental in Cancun from $14/day. Drive to Tulum, Chichen Itza. Full insurance included.' },
  { origin: 'San Juan (SJU)', dest: 'San Juan, PR', originName: 'San Juan', destName: 'San Juan', price: 20, car: 'Compact', desc: 'Car rental in San Juan. Explore El Yunque, Vieques, and the island.' },
];

let dealCache = [];
let lastFetch = 0;
const CACHE_TTL = 60 * 60 * 1000;

function toDeal(d) {
  return {
    title: `Car Rental: ${d.originName} — ${d.car} from $${d.price}/day`,
    description: d.desc + ' Book via joeljourneys.com',
    price: `From $${d.price}/day`,
    origin: d.origin,
    destination: d.dest,
    type: 'Car Rental',
    category: d.car,
    link: AFF.getCarRental.url,
    affiliateUrl: AFF.getCarRental.url,
    expires: new Date(Date.now() + 30 * 86400000).toISOString(),
    date: new Date().toISOString(),
    source: 'carrental'
  };
}

function fetchDeals() {
  const now = Date.now();
  if (now - lastFetch < CACHE_TTL && dealCache.length) {
    return Promise.resolve(dealCache);
  }
  const deals = RENTAL_DEALS.map(toDeal);
  deals.sort((a, b) => parseInt(a.price.replace(/\D/g, '')) - parseInt(b.price.replace(/\D/g, '')));
  dealCache = deals;
  lastFetch = now;
  console.log(`CarRental: ${dealCache.length} deals cached`);
  return Promise.resolve(dealCache);
}

module.exports = { fetchDeals };
