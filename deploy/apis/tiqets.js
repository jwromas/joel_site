const AFF = require('../affiliates');
const TIQETS_URL = AFF.tiqets.url;

const DEALS = [
  { city: 'Paris', attraction: 'Louvre Museum Skip-the-Line', price: 22, desc: 'Skip the long queues at the Louvre. See the Mona Lisa and masterpieces without the wait.' },
  { city: 'Paris', attraction: 'Eiffel Tower Summit Access', price: 35, desc: 'Priority access to the Eiffel Tower summit. Breathtaking views of Paris from the top.' },
  { city: 'Rome', attraction: 'Colosseum & Roman Forum', price: 19, desc: 'Skip-the-line access to the Colosseum and Roman Forum. Walk in the footsteps of gladiators.' },
  { city: 'Rome', attraction: 'Vatican Museums & Sistine Chapel', price: 31, desc: 'Priority entry to the Vatican Museums. See Michelangelo\'s masterpiece in the Sistine Chapel.' },
  { city: 'Barcelona', attraction: 'Sagrada Familia Priority Entry', price: 26, desc: 'Skip-the-line to Gaudí\'s masterpiece. Explore the breathtaking basilica.' },
  { city: 'Barcelona', attraction: 'Park Güell Entry', price: 10, desc: 'Visit Gaudí\'s colorful park with stunning city views. Priority entry included.' },
  { city: 'London', attraction: 'London Eye Fast Track', price: 29, desc: 'Fast-track tickets for the London Eye. Soar above the Thames for iconic views.' },
  { city: 'London', attraction: 'Tower of London Entry', price: 34, desc: 'Entry to the historic Tower of London. See the Crown Jewels and meet the Beefeaters.' },
  { city: 'New York', attraction: 'Empire State Building Observatory', price: 44, desc: 'Priority access to the Empire State Building. 360-degree views of NYC from the top.' },
  { city: 'New York', attraction: 'Statue of Liberty & Ellis Island', price: 25, desc: 'Ferry tickets to the Statue of Liberty and Ellis Island. Includes museum access.' },
  { city: 'Amsterdam', attraction: 'Anne Frank House Entry', price: 16, desc: 'Timed entry to the Anne Frank House. The historic secret annex where Anne wrote her diary.' },
  { city: 'Amsterdam', attraction: 'Van Gogh Museum Ticket', price: 20, desc: 'Skip the ticket line at the Van Gogh Museum. See the world\'s largest Van Gogh collection.' },
  { city: 'Dubai', attraction: 'Burj Khalifa At the Top', price: 38, desc: 'Priority access to the world\'s tallest building. Stunning views from the 124th floor.' },
  { city: 'Dubai', attraction: 'Dubai Aquarium Entry', price: 30, desc: 'Entry to the Dubai Aquarium in the Dubai Mall. See thousands of aquatic animals.' },
  { city: 'Istanbul', attraction: 'Hagia Sophia & Blue Mosque Tour', price: 15, desc: 'Guided tour of Hagia Sophia and the Blue Mosque. Discover Istanbul\'s rich history.' },
  { city: 'Florence', attraction: 'Uffizi Gallery Skip-the-Line', price: 28, desc: 'Skip the queue at the Uffizi Gallery. See Botticelli\'s Birth of Venus and Renaissance masterpieces.' },
];

let dealCache = [];
let lastFetch = 0;
const CACHE_TTL = 60 * 60 * 1000;

function toDeal(d) {
  const isNew = Math.random() > 0.7;
  const label = isNew ? ' — Popular' : '';
  return {
    title: `${d.attraction} — $${d.price}${label}`,
    description: `${d.desc} Book via joeljourneys.com`,
    price: `From $${d.price}`,
    origin: 'Any',
    destination: d.city,
    type: 'Attraction',
    category: 'Activities',
    link: TIQETS_URL,
    affiliateUrl: TIQETS_URL,
    expires: new Date(Date.now() + (isNew ? 3 : 14) * 86400000).toISOString(),
    date: new Date().toISOString(),
    source: 'tiqets'
  };
}

function fetchDeals() {
  const now = Date.now();
  if (now - lastFetch < CACHE_TTL && dealCache.length) {
    return Promise.resolve(dealCache);
  }
  const deals = DEALS.map(toDeal);
  deals.sort((a, b) => parseInt(a.price.replace(/\D/g, '')) - parseInt(b.price.replace(/\D/g, '')));
  dealCache = deals;
  lastFetch = now;
  console.log(`Tiqets: ${dealCache.length} attraction deals cached`);
  return Promise.resolve(dealCache);
}

module.exports = { fetchDeals };
