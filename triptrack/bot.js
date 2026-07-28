const { Client, GatewayIntentBits, EmbedBuilder, Events } = require('discord.js');
const fs = require('fs');
const path = require('path');
const http = require('http');

const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const CHANNEL_ID = process.env.DISCORD_CHANNEL_ID || '1531028835280224326';
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const DB_PATH = fs.existsSync('/data') ? '/data/data.json' : path.join(__dirname, 'data.json');
const POLL_INTERVAL = 4000;

// ── Helpers ─────────────────────────────────────────────────

function loadDB() {
  try {
    if (!fs.existsSync(DB_PATH)) return { customers: [], trips: [], itinerary: [], notifications: [], messages: [], verifications: [] };
    const raw = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
    if (!raw.messages) raw.messages = [];
    if (!raw.verifications) raw.verifications = [];
    return raw;
  } catch {
    return { customers: [], trips: [], itinerary: [], notifications: [], messages: [], verifications: [] };
  }
}

function saveDB(data) {
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
}

function apiGet(p) {
  return new Promise((resolve, reject) => {
    http.get(`${BASE_URL}${p}`, res => {
      let body = '';
      res.on('data', c => (body += c));
      res.on('end', () => { try { resolve(JSON.parse(body)); } catch { resolve(null); } });
    }).on('error', () => resolve(null));
  });
}

function apiPost(p, data) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(data);
    const url = new URL(`${BASE_URL}${p}`);
    const opts = { hostname: url.hostname, port: url.port, path: url.pathname, method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) } };
    const req = http.request(opts, res => {
      let body = '';
      res.on('data', c => (body += c));
      res.on('end', () => { try { resolve(JSON.parse(body)); } catch { resolve(null); } });
    });
    req.on('error', () => resolve(null));
    req.end(payload);
  });
}

function formatDate(d) {
  if (!d) return 'TBD';
  try { return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); }
  catch { return d; }
}

function findTripContext(tripId) {
  const db = loadDB();
  const trip = db.trips.find(t => t.id === tripId);
  if (!trip) return null;
  const customer = db.customers.find(c => c.id === trip.customer_id) || {};
  const items = db.itinerary.filter(i => i.trip_id === trip.id);
  return { trip, customer, items };
}

// ── Discord Client ──────────────────────────────────────────

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

// Track what we've already posted so we don't duplicate
const postedMessages = new Set();
const postedVerifications = new Set();

// ── Auto-concierge keyword matching ────────────────────────

function autoConcierge(messageText, tripId) {
  const ctx = findTripContext(tripId);
  if (!ctx) return null;
  const { trip, customer, items } = ctx;
  const lower = messageText.toLowerCase();

  // Flight queries
  if (/\b(flight|plane|airline|departure|arrive|boarding|gate)\b/i.test(lower)) {
    const flights = items.filter(i => i.type === 'flight');
    if (flights.length) {
      const list = flights.map(f => {
        let s = `**${f.title}**`;
        if (f.time) s += ` at ${f.time}`;
        if (f.location) s += ` (${f.location})`;
        if (f.description) s += `\n${f.description}`;
        return s;
      }).join('\n');
      return { embeds: [new EmbedBuilder()
        .setTitle(`✈️ Flight Details — ${trip.title}`)
        .setDescription(list)
        .setColor(0x4da6ff)
        .setTimestamp()] };
    }
    return { content: `No flight information found for **${trip.title}** yet. Your concierge will add it soon.` };
  }

  // Hotel queries
  if (/\b(hotel|accommodation|lodge|resort|check.?in|check.?out|room|stay)\b/i.test(lower)) {
    const hotels = items.filter(i => i.type === 'hotel');
    if (hotels.length) {
      const list = hotels.map(h => {
        let s = `**${h.title}**`;
        if (h.time) s += ` — ${h.time}`;
        if (h.location) s += `\n📍 ${h.location}`;
        if (h.description) s += `\n${h.description}`;
        return s;
      }).join('\n');
      return { embeds: [new EmbedBuilder()
        .setTitle(`🏨 Hotel Details — ${trip.title}`)
        .setDescription(list)
        .setColor(0xf0c040)
        .setTimestamp()] };
    }
    return { content: `No hotel information found for **${trip.title}** yet. Your concierge will add it soon.` };
  }

  // Schedule / itinerary queries
  if (/\b(schedule|itinerary|plan|activities|agenda|what.*(doing|plan|doing)|full trip)\b/i.test(lower)) {
    if (items.length) {
      const grouped = {};
      items.forEach(i => { (grouped[i.day_number] = grouped[i.day_number] || []).push(i); });
      const icons = { flight: '✈️', hotel: '🏨', activity: '🎯', restaurant: '🍽️', transport: '🚌', note: '📝' };
      let desc = '';
      Object.entries(grouped).sort((a, b) => a[0] - b[0]).forEach(([day, events]) => {
        desc += `**Day ${day}**\n`;
        events.sort((a, b) => (a.time || '').localeCompare(b.time || ''));
        events.forEach(e => {
          desc += `${icons[e.type] || '📌'} ${e.time ? e.time + ' — ' : ''}${e.title}`;
          if (e.location) desc += ` @ ${e.location}`;
          desc += '\n';
        });
        desc += '\n';
      });
      return { embeds: [new EmbedBuilder()
        .setTitle(`📋 Itinerary — ${trip.title}`)
        .setDescription(desc.trim().slice(0, 4096))
        .setColor(0x4dff88)
        .addFields(
          { name: 'Destination', value: trip.destination || 'TBD', inline: true },
          { name: 'Dates', value: `${formatDate(trip.start_date)} — ${formatDate(trip.end_date)}`, inline: true },
          { name: 'Status', value: trip.status, inline: true }
        )
        .setTimestamp()] };
    }
    return { content: `The itinerary for **${trip.title}** hasn't been filled out yet. Your concierge will build it soon!` };
  }

  // Restaurant queries
  if (/\b(restaurant|dinner|lunch|breakfast|food|dining|eat)\b/i.test(lower)) {
    const restaurants = items.filter(i => i.type === 'restaurant');
    if (restaurants.length) {
      const list = restaurants.map(r => {
        let s = `**${r.title}**`;
        if (r.time) s += ` — ${r.time}`;
        if (r.location) s += `\n📍 ${r.location}`;
        if (r.description) s += `\n${r.description}`;
        return s;
      }).join('\n');
      return { embeds: [new EmbedBuilder()
        .setTitle(`🍽️ Dining — ${trip.title}`)
        .setDescription(list)
        .setColor(0xff8844)
        .setTimestamp()] };
    }
    return null;
  }

  // Transport queries
  if (/\b(transport|transfer|shuttle|taxi|uber|car.?rental|drive)\b/i.test(lower)) {
    const transport = items.filter(i => i.type === 'transport');
    if (transport.length) {
      const list = transport.map(t => {
        let s = `**${t.title}**`;
        if (t.time) s += ` — ${t.time}`;
        if (t.location) s += `\n📍 ${t.location}`;
        if (t.description) s += `\n${t.description}`;
        return s;
      }).join('\n');
      return { embeds: [new EmbedBuilder()
        .setTitle(`🚌 Transport — ${trip.title}`)
        .setDescription(list)
        .setColor(0x8ab4f8)
        .setTimestamp()] };
    }
    return null;
  }

  // General trip info
  if (/\b(trip|details|info|summary|destination|when|where|dates)\b/i.test(lower)) {
    return { embeds: [new EmbedBuilder()
      .setTitle(`🌍 ${trip.title}`)
      .setColor(0xf0c040)
      .addFields(
        { name: 'Destination', value: trip.destination || 'TBD', inline: true },
        { name: 'Dates', value: `${formatDate(trip.start_date)} — ${formatDate(trip.end_date)}`, inline: true },
        { name: 'Status', value: trip.status, inline: true },
        { name: 'Customer', value: customer.name || 'N/A', inline: true }
      )
      .setDescription(trip.notes || 'No additional notes.')
      .setTimestamp()] };
  }

  return null;
}

// ── Map trip IDs to Discord thread IDs for conversation tracking ──
const tripThreadMap = new Map(); // tripId -> threadId

// ── Polling: new customer messages & verifications ──────────

async function pollForUpdates(channel) {
  const db = loadDB();

  // Check for new verifications
  for (const v of (db.verifications || [])) {
    const key = v.id || `${v.customer_id}_${v.trip_id}`;
    if (postedVerifications.has(key)) continue;
    postedVerifications.add(key);

    const customer = db.customers.find(c => c.id === v.customer_id);
    const trip = db.trips.find(t => t.id === v.trip_id);
    if (!customer || !trip) continue;

    const embed = new EmbedBuilder()
      .setTitle('✅ Customer Verified')
      .setColor(0x4dff88)
      .addFields(
        { name: 'Customer', value: customer.name, inline: true },
        { name: 'Email', value: customer.email, inline: true },
        { name: 'Trip', value: trip.title, inline: true },
        { name: 'Destination', value: trip.destination || 'TBD', inline: true },
        { name: 'Dates', value: `${formatDate(trip.start_date)} — ${formatDate(trip.end_date)}`, inline: true },
        { name: 'Status', value: trip.status, inline: true }
      )
      .setFooter({ text: `Trip ID: ${trip.id}` })
      .setTimestamp();

    try {
      await channel.send({ embeds: [embed] });
      console.log(`[BOT] Posted verification for ${customer.name}`);
    } catch (err) {
      console.error('[BOT] Failed to post verification:', err.message);
    }
  }

  // Check for new customer support messages
  for (const msg of db.messages) {
    if (msg.from_admin) continue;
    if (postedMessages.has(msg.id)) continue;
    postedMessages.add(msg.id);

    const trip = db.trips.find(t => t.id === msg.trip_id);
    const customer = db.customers.find(c => c.id === msg.customer_id);
    const customerName = (customer && customer.name) || msg.customer_name || 'Unknown Customer';
    const tripTitle = (trip && trip.title) || 'Unknown Trip';

    // Try auto-concierge first
    const autoReply = autoConcierge(msg.message, msg.trip_id);

    const embed = new EmbedBuilder()
      .setTitle(`💬 Customer Message`)
      .setColor(0xf0c040)
      .addFields(
        { name: 'Customer', value: customerName, inline: true },
        { name: 'Trip', value: tripTitle, inline: true },
        { name: 'Message', value: msg.message.slice(0, 1024) }
      )
      .setFooter({ text: `Trip ID: ${msg.trip_id} • Reply in a thread to respond` })
      .setTimestamp();

    try {
      const sent = await channel.send({ embeds: [embed] });

      // Auto-reply if we have an answer
      if (autoReply) {
        const replyPayload = { ...autoReply };
        if (replyPayload.content) replyPayload.content = `🤖 **Auto-Concierge:** ${replyPayload.content}`;
        if (replyPayload.embeds) {
          replyPayload.embeds = replyPayload.embeds.map(e => EmbedBuilder.from(e));
        }
        await sent.reply(replyPayload);

        // Also write the auto-reply to portal messages so customer sees it
        const replyText = autoReply.content || (autoReply.embeds && autoReply.embeds[0] && autoReply.embeds[0].data && autoReply.embeds[0].data.description) || 'Auto-concierge response';
        const db2 = loadDB();
        db2.messages.push({
          id: 'msg_' + require('crypto').randomBytes(8).toString('hex'),
          trip_id: msg.trip_id,
          customer_id: msg.customer_id,
          customer_name: 'Concierge',
          message: replyText,
          from_admin: true,
          created_at: new Date().toISOString()
        });
        saveDB(db2);
        console.log(`[BOT] Auto-answered and posted to portal for ${customerName}`);
      } else {
        // Create thread for manual admin response
        try {
          const thread = await sent.startThread({
            name: `${customerName} — ${tripTitle}`,
            autoArchiveDuration: 1440,
            reason: 'Customer support thread',
          });
          tripThreadMap.set(msg.trip_id, thread.id);
          await thread.send(`📋 Trip ID: \`${msg.trip_id}\`\nCustomer: **${customerName}** (${customer ? customer.email : 'N/A'})\n\nReply here to respond to the customer. Your message will be sent to their portal.`);
        } catch (threadErr) {
          console.error('[BOT] Failed to create thread:', threadErr.message);
        }
      }

      console.log(`[BOT] Posted message from ${customerName}`);
    } catch (err) {
      console.error('[BOT] Failed to post message:', err.message);
    }
  }
}

// ── Inbound: admin replies relay to customer ────────────────

function extractTripId(message) {
  // Check the embed footer for trip ID
  if (message.embeds && message.embeds.length) {
    const footer = message.embeds[0].footer?.text || '';
    const match = footer.match(/Trip ID:\s*(\w+_\w+)/);
    if (match) return match[1];
  }
  // Check for inline code blocks
  const codeMatch = message.content.match(/Trip ID:\s*`?(\w+_\w+)`?/);
  if (codeMatch) return codeMatch[1];
  return null;
}

async function relayReplyToCustomer(tripId, replyText, adminName) {
  const db = loadDB();
  const msg = {
    id: 'msg_' + require('crypto').randomBytes(8).toString('hex'),
    trip_id: tripId,
    customer_id: (db.trips.find(t => t.id === tripId) || {}).customer_id || '',
    customer_name: adminName,
    message: replyText,
    from_admin: true,
    created_at: new Date().toISOString()
  };
  db.messages.push(msg);
  saveDB(db);
  console.log(`[BOT] Relied reply to trip ${tripId} in messages`);
  return true;
}

// ── Bot Events ──────────────────────────────────────────────

client.once(Events.ClientReady, async c => {
  console.log(`[BOT] Ready — logged in as ${c.user.tag}`);
  console.log(`[BOT] Watching channel ${CHANNEL_ID}`);

  const channel = await c.channels.fetch(CHANNEL_ID).catch(() => null);
  if (!channel) {
    console.error(`[BOT] Could not access channel ${CHANNEL_ID}. Check bot permissions.`);
    return;
  }

  // Start polling
  setInterval(() => pollForUpdates(channel).catch(e => console.error('[BOT] Poll error:', e.message)), POLL_INTERVAL);
  // Initial poll
  pollForUpdates(channel).catch(e => console.error('[BOT] Initial poll error:', e.message));
});

client.on(Events.MessageCreate, async message => {
  // Ignore bot's own messages
  if (message.author.id === client.user.id) return;

  // Only process messages in the support channel or threads created from it
  const inSupportChannel = message.channelId === CHANNEL_ID;
  const inSupportThread = message.channel.isThread() && message.channel.parentId === CHANNEL_ID;
  if (!inSupportChannel && !inSupportThread) return;

  // ── Thread replies: relay to customer ──
  if (inSupportThread && message.content) {
    const threadId = message.channelId;

    // Find the trip this thread belongs to
    let tripId = null;

    // Check our map first
    for (const [tid, tidDiscord] of tripThreadMap.entries()) {
      if (tidDiscord === threadId) { tripId = tid; break; }
    }

    // Fallback: check thread messages for trip ID
    if (!tripId) {
      try {
        const firstMessages = await message.channel.messages.fetch({ limit: 10 });
        for (const [, m] of firstMessages) {
          const id = extractTripId(m);
          if (id) { tripId = id; break; }
        }
      } catch {}
    }

    // Also check the thread starter message
    if (!tripId && message.channel) {
      try {
        const starter = await message.channel.fetchStarterMessage();
        if (starter) {
          const id = extractTripId(starter);
          if (id) tripId = id;
        }
      } catch {}
    }

    if (tripId) {
      const sent = await relayReplyToCustomer(tripId, message.content, message.author.displayName || message.author.username);
      if (sent) {
        await message.react('✅').catch(() => {});
      } else {
        await message.react('❌').catch(() => {});
      }
    } else {
      await message.react('⚠️').catch(() => {});
      await message.reply('⚠️ Could not determine which trip this reply belongs to. Check the thread context.').catch(() => {});
    }
    return;
  }

  // ── Direct messages in the support channel: check if it's a reply ──
  if (inSupportChannel && message.content) {
    // If replying to a bot message that contains trip info
    if (message.reference && message.reference.messageId) {
      try {
        const refMsg = await message.channel.messages.fetch(message.reference.messageId);
        if (refMsg.author.id === client.user.id) {
          const tripId = extractTripId(refMsg);
          if (tripId && message.content) {
            const sent = await relayReplyToCustomer(tripId, message.content, message.author.displayName || message.author.username);
            if (sent) {
              await message.react('✅').catch(() => {});
            } else {
              await message.react('❌').catch(() => {});
            }
            return;
          }
        }
      } catch {}
    }

    // Auto-concierge for direct queries (try to match from recent messages)
    // Only respond if the message looks like a question and we can find a trip context
    if (/\?/.test(message.content)) {
      const db = loadDB();
      // Find most recent trip mentioned in channel recently, or latest trip overall
      const trips = db.trips.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      if (trips.length > 0) {
        const latestTrip = trips[0];
        const autoReply = autoConcierge(message.content, latestTrip.id);
        if (autoReply) {
          const replyPayload = { ...autoReply };
          if (replyPayload.content) replyPayload.content = `🤖 **Auto-Concierge:** ${replyPayload.content}`;
          if (replyPayload.embeds) {
            replyPayload.embeds = replyPayload.embeds.map(e => EmbedBuilder.from(e));
          }
          try { await message.reply(replyPayload); } catch {}
        }
      }
    }
  }
});

// ── Graceful shutdown ───────────────────────────────────────

process.on('SIGINT', () => {
  console.log('[BOT] Shutting down...');
  client.destroy();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('[BOT] Shutting down...');
  client.destroy();
  process.exit(0);
});

// ── Login ───────────────────────────────────────────────────

if (!DISCORD_TOKEN) {
  console.error('[BOT] Missing DISCORD_TOKEN environment variable.');
  process.exit(1);
}

client.login(DISCORD_TOKEN);
