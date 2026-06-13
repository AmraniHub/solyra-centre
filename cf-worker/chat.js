/**
 * Solyra Chat Worker — Cloudflare Workers AI (free tier)
 * Deploy: wrangler deploy (from this folder)
 */

const MODELS = {
  primary: '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
  fallback: '@cf/meta/llama-3.1-8b-instruct',
};

const MAX_MESSAGES  = 12;
const MAX_MSG_CHARS = 2000;
const MAX_BODY_BYTES = 32 * 1024;
const RATE_LIMIT    = 25; // req/min per IP

/* ── Simple in-memory rate limiter (resets per isolate restart) ── */
const rl = new Map();
function isAllowed(ip) {
  const now = Date.now();
  let e = rl.get(ip) || { n: 0, reset: now + 60_000 };
  if (now > e.reset) { e.n = 0; e.reset = now + 60_000; }
  e.n++;
  rl.set(ip, e);
  return e.n <= RATE_LIMIT;
}

/* ── Language detection ── */
function detectLang(text) {
  if (/[؀-ۿ]/.test(text)) return 'ar';
  if (/\b(bonjour|merci|comment|je|vous|quelle?|est-ce|les|des|une?|pour|avec|dans|sur|mon|ma|mes|voudrais|réserver)\b/i.test(text)) return 'fr';
  if (/\b(hello|hi|what|how|price|book|hair|skin|nail|service|where|when|want|need|cost)\b/i.test(text)) return 'en';
  return 'ar';
}

/* ── System prompts ── */
const SYSTEM = {
  ar: `أنتِ خبيرة تجميل ومستشارة في مركز Solyra بطنجة، المغرب. ردودك ودودة، قصيرة (3-4 جمل فقط)، ومحترفة. لا تستخدمي قوائم أو نقاط — اكتبي بأسلوب طبيعي.

معلومات مركز Solyra:
- العنوان: 29 شارع الأمير مولاي عبد الله، أمام سينما ميغاراما غويا، طنجة
- الهاتف/واتساب: 0619946109
- أوقات العمل: الاثنين – السبت · 9 صباحاً حتى 8 مساءً
- الخبرة: 6 سنوات في تجميل المرأة المغربية
- الضمان: نتيجة 100% من الجلسة الأولى أو نعيد الجلسة مجاناً بدون أسئلة

الخدمات:
• بروتين الشعر Nano Gel — شعر ناعم ولامع لـ4 أشهر، الجلسة 2-3 ساعات
• هيدرافيشل — بشرة مضيئة ونضرة في 60 دقيقة، تناسب البشرة الحساسة
• ميزوثيرابي — تجديد شباب بدون جراحة، نتيجة مرئية من الجلسة الأولى
• إزالة الشعر — تقنيات متعددة، نتيجة تدوم أسابيع، للوجه والجسم
• تلوين وصبغ الشعر — بالات، أومبري، هايلايت، تغطية الشيب لشهر كامل
• مانيكير وباديكير — جل فرنسي، أكريليك، نقش احترافي يدوم 3 أسابيع

قواعد صارمة:
1. لا تعطي أسعاراً أبداً — قولي "للاستفسار عن الأسعار تواصلي معنا على الواتساب 0619946109"
2. شجعي دائماً على الحجز في نهاية ردك
3. إذا طلبت الحجز أو أبدت اهتماماً واضحاً بخدمة: أضيفي [SHOW_FORM] في نهاية ردك لإظهار نموذج الحجز تلقائياً
4. لا تعدي بخدمات غير مذكورة
5. ردودك بالعربية دائماً إلا إذا كتبت بلغة أخرى`,

  fr: `Tu es une experte beauté et conseillère au Centre Solyra à Tanger, Maroc. Tes réponses sont chaleureuses, courtes (3-4 phrases max) et professionnelles. Pas de listes ou de tirets — écris naturellement.

Informations Centre Solyra:
- Adresse: 29 Avenue Prince Moulay Abdellah, en face du cinéma Megarama Goya, Tanger
- Téléphone/WhatsApp: 0619946109
- Horaires: Lundi – Samedi · 9h à 20h
- Expérience: 6 ans au service de la femme marocaine
- Garantie: Résultat 100% dès la 1ère séance ou on recommence sans questions

Services:
• Protéine Nano Gel — Cheveux lisses et brillants pendant 4 mois, séance 2-3h
• HydraFacial — Peau lumineuse et éclatante en 60 min, idéale pour peaux sensibles
• Mésothérapie — Rajeunissement sans chirurgie, résultat dès la 1ère séance
• Épilation — Plusieurs techniques, résultats durables semaines, visage et corps
• Coloration & Teinture — Balayage, ombré, highlights, couverture blancs pendant 1 mois
• Manucure & Pédicure — Gel français, acrylique, nail art, tient 3 semaines

Règles strictes:
1. Ne donne jamais de prix — dis "Pour les tarifs, contactez-nous sur WhatsApp 0619946109"
2. Encourage toujours à prendre rendez-vous en fin de réponse
3. Si la cliente demande à réserver ou montre un intérêt clair pour un service: ajoute [SHOW_FORM] à la fin de ta réponse pour afficher automatiquement le formulaire de réservation
4. Réponds toujours en français si le message est en français`,

  en: `You are a beauty expert and advisor at Centre Solyra in Tangier, Morocco. Your replies are warm, short (3-4 sentences max), and professional. No bullet lists — write naturally.

Centre Solyra information:
- Address: 29 Avenue Prince Moulay Abdellah, opposite Megarama Goya cinema, Tangier
- Phone/WhatsApp: 0619946109
- Hours: Monday – Saturday · 9am to 8pm
- Experience: 6 years serving Moroccan women
- Guarantee: 100% result from first session or we redo it free, no questions asked

Services:
• Nano Gel Hair Protein — Smooth shiny hair for 4 months, session 2-3h
• HydraFacial — Glowing radiant skin in 60 minutes, suits sensitive skin
• Mesotherapy — Anti-aging without surgery, visible result from session one
• Hair Removal — Multiple techniques, results last weeks, face and full body
• Hair Coloring — Balayage, ombré, highlights, grey coverage lasting 1 month
• Manicure & Pedicure — French gel, acrylic, nail art lasting 3 weeks

Strict rules:
1. Never give prices — say "For pricing, contact us on WhatsApp 0619946109"
2. Always encourage booking at the end of your reply
3. If the user asks to book or shows clear interest in a service: add [SHOW_FORM] at the end of your reply to automatically display the booking form
4. Always reply in English if the message is in English`,
};

/* ── Main handler ── */
export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const ok = origin.includes('solyra') || origin.includes('localhost') || origin === '';

    const cors = {
      'Access-Control-Allow-Origin':  ok ? (origin || '*') : 'https://solyra-centre.vercel.app',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age':       '86400',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors });
    }

    if (request.method !== 'POST') {
      return new Response('Method Not Allowed', { status: 405, headers: cors });
    }

    /* Rate limit */
    const ip = request.headers.get('CF-Connecting-IP') || 'anon';
    if (!isAllowed(ip)) {
      return json({ error: 'Too many requests. Please slow down.' }, 429, cors);
    }

    /* Body size guard */
    const cl = parseInt(request.headers.get('Content-Length') || '0');
    if (cl > MAX_BODY_BYTES) return json({ error: 'Payload too large' }, 413, cors);

    let body;
    try { body = await request.json(); }
    catch { return json({ error: 'Invalid JSON' }, 400, cors); }

    const rawMessages = Array.isArray(body.messages) ? body.messages : [];

    /* Sanitise */
    const messages = rawMessages
      .slice(-MAX_MESSAGES)
      .filter(m => m.role === 'user' || m.role === 'assistant')
      .map(m => ({ role: m.role, content: String(m.content || '').slice(0, MAX_MSG_CHARS) }));

    if (!messages.length) return json({ error: 'No messages provided' }, 400, cors);

    /* Language + system prompt */
    const lastUser = [...messages].reverse().find(m => m.role === 'user')?.content || '';
    const lang = detectLang(lastUser);

    const aiMessages = [
      { role: 'system', content: SYSTEM[lang] },
      ...messages,
    ];

    /* Run AI with streaming, fallback to 8B if 70B fails */
    async function runStream(model) {
      return env.AI.run(model, {
        messages: aiMessages,
        stream: true,
        max_tokens: 420,
        temperature: 0.72,
      });
    }

    try {
      let stream;
      try {
        stream = await runStream(MODELS.primary);
      } catch {
        stream = await runStream(MODELS.fallback);
      }

      return new Response(stream, {
        headers: {
          ...cors,
          'Content-Type':            'text/event-stream',
          'Cache-Control':           'no-cache, no-store',
          'X-Content-Type-Options':  'nosniff',
        },
      });
    } catch (err) {
      return json({ error: 'AI service unavailable', detail: String(err.message) }, 503, cors);
    }
  },
};

function json(data, status, cors) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });
}
