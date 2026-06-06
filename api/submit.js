import crypto from 'crypto';

const TELEGRAM_BOT_TOKEN  = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID    = process.env.TELEGRAM_CHAT_ID;
const SHEETS_WEBHOOK_URL  = process.env.SHEETS_WEBHOOK_URL;
const META_PIXEL_ID       = process.env.META_PIXEL_ID;
const META_ACCESS_TOKEN   = process.env.META_ACCESS_TOKEN;

function sha256(value) {
  return crypto.createHash('sha256').update(value.trim().toLowerCase()).digest('hex');
}

function moroccanTime() {
  return new Date().toLocaleString('fr-MA', {
    timeZone: 'Africa/Casablanca',
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
}

// ── Telegram: booking lead ────────────────────────────────────
async function sendTelegramLead(name, phone, service) {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) return;
  const text = [
    `🌸 <b>حجز جديد — Centre Solyra</b>`,
    ``,
    `👤 <b>الاسم:</b> ${name}`,
    `📞 <b>الهاتف:</b> <code>${phone}</code>`,
    `💅 <b>الخدمة:</b> ${service}`,
    `🕐 <b>التوقيت:</b> ${moroccanTime()}`,
  ].join('\n');

  await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text, parse_mode: 'HTML' })
  });
}

// ── Telegram: recruitment application ────────────────────────
async function sendTelegramRecruit(name, phone, specialty, experience, previousSalon) {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) return;
  const text = [
    `💼 <b>طلب توظيف جديد — Centre Solyra</b>`,
    ``,
    `👤 <b>الاسم:</b> ${name}`,
    `📞 <b>الهاتف:</b> <code>${phone}</code>`,
    `💅 <b>التخصص:</b> ${specialty}`,
    `⏱ <b>الخبرة:</b> ${experience}`,
    `🏪 <b>آخر صالون:</b> ${previousSalon || 'غير محدد'}`,
    `🕐 <b>التوقيت:</b> ${moroccanTime()}`,
  ].join('\n');

  await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text, parse_mode: 'HTML' })
  });
}

// ── Google Sheets ─────────────────────────────────────────────
async function sendToSheets(payload) {
  if (!SHEETS_WEBHOOK_URL) return;
  await fetch(SHEETS_WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
}

// ── Meta CAPI ─────────────────────────────────────────────────
async function sendMetaCAPI(name, phone, eventId, clientIp, userAgent, eventSourceUrl, eventName, fbp, fbc) {
  if (!META_PIXEL_ID || !META_ACCESS_TOKEN) return;
  const userData = {
    ph: [sha256(phone)],
    fn: [sha256(name)],
    client_ip_address: clientIp,
    client_user_agent: userAgent,
  };
  if (fbp) userData.fbp = fbp;
  if (fbc) userData.fbc = fbc;
  const payload = {
    data: [{
      event_name: eventName,
      event_time: Math.floor(Date.now() / 1000),
      event_id: eventId,
      event_source_url: eventSourceUrl,
      action_source: 'website',
      user_data: userData,
    }]
  };
  await fetch(
    `https://graph.facebook.com/v19.0/${META_PIXEL_ID}/events?access_token=${META_ACCESS_TOKEN}`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }
  );
}

// ── Main handler ──────────────────────────────────────────────
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const {
    type = 'lead',
    name = '', phone = '', service = '',
    experience = '', previousSalon = '',
    eventId = '', userAgent = '', eventSourceUrl = '',
    fbp = '', fbc = ''
  } = req.body || {};

  const clientIp = req.headers['x-forwarded-for']?.split(',')[0] || req.socket?.remoteAddress || '';

  if (type === 'recrutement') {
    // ── recruitment submission ──
    await Promise.allSettled([
      sendTelegramRecruit(name, phone, service, experience, previousSalon),
      sendToSheets({
        type: 'recrutement',
        name, phone, service, experience, previousSalon,
        timestamp: moroccanTime()
      }),
      sendMetaCAPI(name, phone, eventId, clientIp, userAgent, eventSourceUrl, 'CompleteRegistration', fbp, fbc),
    ]);
  } else {
    // ── booking lead (default) ──
    await Promise.allSettled([
      sendTelegramLead(name, phone, service),
      sendToSheets({
        type: 'lead',
        name, phone, service,
        timestamp: moroccanTime()
      }),
      sendMetaCAPI(name, phone, eventId, clientIp, userAgent, eventSourceUrl, 'Lead', fbp, fbc),
    ]);
  }

  return res.status(200).json({ ok: true });
}
