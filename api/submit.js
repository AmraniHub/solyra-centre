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

async function sendTelegram(name, phone, service) {
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

async function sendToSheets(name, phone, service) {
  if (!SHEETS_WEBHOOK_URL) return;
  await fetch(SHEETS_WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ timestamp: moroccanTime(), name, phone, service })
  });
}

async function sendMetaCAPI(name, phone, eventId, clientIp, userAgent, eventSourceUrl) {
  if (!META_PIXEL_ID || !META_ACCESS_TOKEN) return;
  const payload = {
    data: [{
      event_name: 'Lead',
      event_time: Math.floor(Date.now() / 1000),
      event_id: eventId,
      event_source_url: eventSourceUrl,
      action_source: 'website',
      user_data: {
        ph: [sha256(phone)],
        fn: [sha256(name)],
        client_ip_address: clientIp,
        client_user_agent: userAgent,
      }
    }]
  };
  await fetch(
    `https://graph.facebook.com/v19.0/${META_PIXEL_ID}/events?access_token=${META_ACCESS_TOKEN}`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }
  );
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { name = '', phone = '', service = '', eventId = '', userAgent = '', eventSourceUrl = '' } = req.body || {};
  const clientIp = req.headers['x-forwarded-for']?.split(',')[0] || req.socket?.remoteAddress || '';

  await Promise.allSettled([
    sendTelegram(name, phone, service),
    sendToSheets(name, phone, service),
    sendMetaCAPI(name, phone, eventId, clientIp, userAgent, eventSourceUrl),
  ]);

  return res.status(200).json({ ok: true });
}
