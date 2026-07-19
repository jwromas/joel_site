require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const fs = require('fs');
const path = require('path');

const apis = {
  aviasales: require('./apis/aviasales'),
  gettransfer: require('./apis/gettransfer'),
  viator: require('./apis/viator'),
  gigsky: require('./apis/gigsky'),
  ticketmaster: require('./apis/ticketmaster'),
  hotels: require('./apis/hotels'),
  carrental: require('./apis/carrental'),
  timeflys: require('./apis/timeflys'),
  tiqets: require('./apis/tiqets'),
};

async function main() {
  const allDeals = [];
  const errors = [];

  for (const [name, mod] of Object.entries(apis)) {
    try {
      const deals = await mod.fetchDeals();
      if (Array.isArray(deals) && deals.length) {
        deals.forEach(d => d._source = name);
        allDeals.push(...deals);
        console.log(`[${name}] ${deals.length} deals`);
      } else {
        console.log(`[${name}] 0 deals`);
      }
    } catch (e) {
      errors.push({ name, error: e.message });
      console.log(`[${name}] ERROR: ${e.message}`);
    }
  }

  const output = {
    fetched: new Date().toISOString(),
    total: allDeals.length,
    deals: allDeals,
    errors
  };

  const outPath = path.join(__dirname, 'live_deals.json');
  fs.writeFileSync(outPath, JSON.stringify(output, null, 2));
  console.log(`\nSaved ${allDeals.length} live deals to ${outPath}`);
  if (errors.length) console.log(`Errors: ${errors.map(e => e.name).join(', ')}`);
}

main().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
