/**
 * Centre Solyra — AI Chat Widget
 * Powered by Cloudflare Workers AI (free)
 *
 * SETUP: After deploying cf-worker/, replace the URL below with your Worker URL.
 * Format: https://solyra-chat.YOUR_SUBDOMAIN.workers.dev/chat
 */
(function () {
  'use strict';

  /* ── Config ─────────────────────────────────────────────────────────── */
  var WORKER_URL  = 'https://solyra-chat.amrani4online.workers.dev/chat';
  var SUBMIT_URL  = '/api/submit';
  var SESSION_KEY = 'sc_v1';
  var SESSION_TTL = 2 * 60 * 60 * 1000; // 2 hours
  var WA_NUMBER   = '212619946109';

  /* ── State ──────────────────────────────────────────────────────────── */
  var isOpen     = false;
  var streaming  = false;
  var leadShown  = false;
  var msgCount   = 0;
  var messages   = [];
  var lang       = 'ar';
  var profile    = { name: '', phone: '', services: [] };

  /* ── UI strings ─────────────────────────────────────────────────────── */
  var UI = {
    ar: {
      headerName:   'مساعدة Solyra 🌸',
      headerStatus: '● متاحة الآن',
      placeholder:  'اكتبي سؤالك...',
      sendIcon:     '↑',
      welcome:      'مرحباً! 🌸 أنا مساعدتك في مركز Solyra بطنجة. يمكنني مساعدتك في اختيار الخدمة المناسبة أو الإجابة على أي سؤال. كيف يمكنني مساعدتك؟',
      nudge:        'مرحباً 🌸 هل تحتاجين مساعدة في اختيار الخدمة المناسبة لك؟',
      chips:        ['💇 بروتين الشعر', '✨ هيدرافيشل', '📍 الموقع', '📅 احجزي موعد'],
      leadTitle:    '🌸 احجزي موعدك',
      leadSub:      'أرسلي بياناتك وسنتصل بك خلال ساعة',
      namePh:       'الاسم الكامل',
      phonePh:      '06XXXXXXXX',
      submitBtn:    'إرسال الطلب ←',
      thanksText:   '✅ شكراً! سيتصل بك فريقنا خلال ساعة. يمكنك التواصل معنا مباشرة:',
      waBtn:        '📱 تواصلي عبر واتساب',
      resumedLabel: '↩ تم استئناف المحادثة',
      error:        'عذراً، حدث خطأ. حاولي مرة أخرى.',
      waMsg:        function(n){ return encodeURIComponent('مرحباً مركز Solyra 🌸 أنا ' + n + ' وأريد حجز موعد.'); },
    },
    fr: {
      headerName:   'Conseillère Solyra 🌸',
      headerStatus: '● En ligne',
      placeholder:  'Écrivez votre question...',
      sendIcon:     '↑',
      welcome:      'Bonjour ! 🌸 Je suis votre conseillère beauté au Centre Solyra de Tanger. Je peux vous aider à choisir le service idéal ou répondre à vos questions. Comment puis-je vous aider ?',
      nudge:        'Bonjour 🌸 Avez-vous besoin d\'aide pour choisir votre service beauté idéal ?',
      chips:        ['💇 Protéine', '✨ HydraFacial', '📍 Localisation', '📅 Réserver'],
      leadTitle:    '🌸 Réserver une séance',
      leadSub:      'Laissez vos coordonnées et nous vous rappellerons',
      namePh:       'Votre nom complet',
      phonePh:      '06XXXXXXXX',
      submitBtn:    'Envoyer →',
      thanksText:   '✅ Merci ! Notre équipe vous rappellera dans l\'heure. Vous pouvez aussi nous contacter directement :',
      waBtn:        '📱 WhatsApp Direct',
      resumedLabel: '↩ Conversation reprise',
      error:        'Désolé, une erreur s\'est produite. Réessayez.',
      waMsg:        function(n){ return encodeURIComponent('Bonjour Centre Solyra 🌸 Je suis ' + n + ' et je voudrais prendre rendez-vous.'); },
    },
    en: {
      headerName:   'Solyra Advisor 🌸',
      headerStatus: '● Online',
      placeholder:  'Type your question...',
      sendIcon:     '↑',
      welcome:      'Hello! 🌸 I\'m your beauty advisor at Centre Solyra, Tangier. I can help you choose the right service or answer any question. How can I help you?',
      nudge:        'Hello 🌸 Need help choosing the perfect beauty service for you?',
      chips:        ['💇 Hair Protein', '✨ HydraFacial', '📍 Location', '📅 Book Now'],
      leadTitle:    '🌸 Book Your Session',
      leadSub:      'Send your details and we\'ll call you within the hour',
      namePh:       'Your full name',
      phonePh:      '06XXXXXXXX',
      submitBtn:    'Send Request →',
      thanksText:   '✅ Thank you! Our team will call you within the hour. You can also reach us directly:',
      waBtn:        '📱 WhatsApp Direct',
      resumedLabel: '↩ Conversation resumed',
      error:        'Sorry, an error occurred. Please try again.',
      waMsg:        function(n){ return encodeURIComponent('Hello Centre Solyra 🌸 I\'m ' + n + ' and I\'d like to book an appointment.'); },
    },
  };

  /* ── Language detection ─────────────────────────────────────────────── */
  function detectLang(text) {
    if (/[؀-ۿ؀-ۿ]/.test(text)) return 'ar';
    if (/\b(bonjour|merci|comment|je|vous|quelle?|est|les|des|une?|pour|avec|dans|sur|voudrais|réserver|quel)\b/i.test(text)) return 'fr';
    if (/\b(hello|hi|what|how|price|book|hair|skin|nail|service|where|when|want|need|cost|appointment)\b/i.test(text)) return 'en';
    return lang;
  }

  /* ── Intent detection ────────────────────────────────────────────────── */
  function hasIntent(text) {
    return /حجز|موعد|أحجز|احجزي|بكم|السعر|كم|réserver|rendez-vous|prix|tarif|combien|book|appointment|price|cost|how much/i.test(text);
  }

  /* ── Profile extraction ──────────────────────────────────────────────── */
  function extractProfile(text) {
    var svcs = ['بروتين','هيدرا','ميزو','إزالة','تلوين','مانيكير','protein','hydra','meso','wax','color','manicure','protéine','mésothérapie','épilation','coloration'];
    svcs.forEach(function(s){
      if (text.toLowerCase().indexOf(s.toLowerCase()) !== -1 && profile.services.indexOf(s) === -1) {
        profile.services.push(s);
      }
    });
  }

  /* ── Cookie helper ───────────────────────────────────────────────────── */
  function getCookie(name) {
    var m = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
    return m ? decodeURIComponent(m[1]) : undefined;
  }

  /* ── Session ─────────────────────────────────────────────────────────── */
  function saveSession() {
    try {
      localStorage.setItem(SESSION_KEY, JSON.stringify({ messages: messages, profile: profile, lang: lang, ts: Date.now() }));
    } catch(e) {}
  }

  function loadSession() {
    try {
      var raw = localStorage.getItem(SESSION_KEY);
      if (!raw) return false;
      var d = JSON.parse(raw);
      if (Date.now() - d.ts > SESSION_TTL) { localStorage.removeItem(SESSION_KEY); return false; }
      messages = d.messages || [];
      profile  = d.profile  || { name: '', phone: '', services: [] };
      setLang(d.lang || 'ar');
      return messages.length > 0;
    } catch(e) { return false; }
  }

  /* ── CSS injection ───────────────────────────────────────────────────── */
  function injectCSS() {
    var s = document.createElement('style');
    s.textContent = [
      '#sc-root{position:fixed;bottom:24px;right:24px;z-index:99999;font-family:"Cairo",sans-serif}',
      '#sc-root *{box-sizing:border-box;margin:0;padding:0;font-family:"Cairo",sans-serif}',

      /* Launcher */
      '#sc-btn{width:58px;height:58px;border-radius:50%;background:linear-gradient(135deg,#e91e8c 0%,#880e4f 100%);border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;box-shadow:0 6px 28px rgba(233,30,140,.5);transition:transform .2s,box-shadow .2s;position:relative;outline:none}',
      '#sc-btn:hover{transform:scale(1.07);box-shadow:0 10px 36px rgba(233,30,140,.6)}',
      '#sc-btn-icon{font-size:1.55rem;line-height:1;pointer-events:none;transition:transform .25s}',
      '#sc-dot{position:absolute;bottom:4px;right:4px;width:12px;height:12px;border-radius:50%;background:#22c55e;border:2.5px solid #fff}',
      '#sc-badge{position:absolute;top:-3px;right:-3px;width:20px;height:20px;border-radius:50%;background:#c9922b;color:#fff;font-size:.6rem;font-weight:700;display:flex;align-items:center;justify-content:center;border:2px solid #fff;animation:scPop .3s ease}',
      '@keyframes scPop{0%{transform:scale(0)}70%{transform:scale(1.25)}100%{transform:scale(1)}}',
      '#sc-pulse{position:absolute;inset:-8px;border-radius:50%;border:2px solid rgba(233,30,140,.35);animation:scPulse 2.4s ease-out infinite;pointer-events:none}',
      '@keyframes scPulse{0%{transform:scale(1);opacity:.9}100%{transform:scale(1.55);opacity:0}}',

      /* Nudge */
      '#sc-nudge{position:absolute;bottom:70px;right:0;background:#fff;border-radius:16px 16px 3px 16px;padding:11px 14px;box-shadow:0 4px 24px rgba(0,0,0,.13);max-width:230px;display:flex;align-items:flex-start;gap:8px;border:1.5px solid rgba(233,30,140,.12);animation:scUp .3s ease;cursor:pointer}',
      '#sc-nudge-txt{font-size:.84rem;color:#1a0510;line-height:1.5;flex:1}',
      '#sc-nudge-x{background:none;border:none;cursor:pointer;color:#c4a4b4;font-size:.95rem;padding:0;flex-shrink:0;margin-top:1px;line-height:1}',

      /* Panel */
      '#sc-panel{position:absolute;bottom:70px;right:0;width:370px;height:570px;background:#fff;border-radius:20px;box-shadow:0 14px 60px rgba(0,0,0,.17);display:flex;flex-direction:column;overflow:hidden;border:1.5px solid rgba(233,30,140,.10);animation:scUp .25s ease}',
      '@keyframes scUp{from{transform:translateY(10px);opacity:0}to{transform:translateY(0);opacity:1}}',

      /* Header */
      '#sc-hd{background:linear-gradient(135deg,#e91e8c 0%,#880e4f 100%);padding:13px 15px;display:flex;align-items:center;justify-content:space-between;flex-shrink:0}',
      '#sc-hd-left{display:flex;align-items:center;gap:10px}',
      '#sc-av{width:36px;height:36px;border-radius:50%;object-fit:cover;object-position:50% 18%;border:2px solid rgba(255,255,255,.35);background:rgba(255,255,255,.15)}',
      '#sc-hd-name{font-size:.92rem;font-weight:700;color:#fff}',
      '#sc-hd-status{font-size:.7rem;color:rgba(255,255,255,.85);margin-top:1px}',
      '#sc-x{background:rgba(255,255,255,.15);border:none;border-radius:50%;width:28px;height:28px;cursor:pointer;color:#fff;font-size:.9rem;display:flex;align-items:center;justify-content:center;transition:background .2s;flex-shrink:0}',
      '#sc-x:hover{background:rgba(255,255,255,.28)}',

      /* Messages */
      '#sc-msgs{flex:1;overflow-y:auto;padding:14px 12px;display:flex;flex-direction:column;gap:9px;scroll-behavior:smooth}',
      '#sc-msgs::-webkit-scrollbar{width:3px}',
      '#sc-msgs::-webkit-scrollbar-thumb{background:#fce4ec;border-radius:3px}',
      '.sc-m{max-width:83%;padding:9px 13px;border-radius:16px;font-size:.87rem;line-height:1.6;animation:scMIn .18s ease;word-wrap:break-word}',
      '@keyframes scMIn{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:none}}',
      '.sc-m.user{background:linear-gradient(135deg,#e91e8c 0%,#880e4f 100%);color:#fff;align-self:flex-end;border-radius:16px 3px 16px 16px}',
      '.sc-m.bot{background:#fce4ec;color:#1a0510;align-self:flex-start;border-radius:3px 16px 16px 16px}',
      '#sc-typing{align-self:flex-start;background:#fce4ec;border-radius:3px 16px 16px 16px;padding:10px 14px;display:flex;gap:5px;align-items:center}',
      '#sc-typing span{width:7px;height:7px;border-radius:50%;background:#e91e8c;animation:scBounce .85s infinite ease}',
      '#sc-typing span:nth-child(2){animation-delay:.14s}',
      '#sc-typing span:nth-child(3){animation-delay:.28s}',
      '@keyframes scBounce{0%,60%,100%{transform:translateY(0)}30%{transform:translateY(-5px)}}',
      '.sc-divider{text-align:center;font-size:.68rem;color:#c4a4b4;padding:2px 0;flex-shrink:0}',

      /* Lead form */
      '#sc-lead{background:#fff5f8;border-top:1.5px solid rgba(233,30,140,.10);padding:12px 14px;flex-shrink:0}',
      '#sc-lead-title{font-size:.9rem;font-weight:700;color:#880e4f;margin-bottom:3px}',
      '#sc-lead-sub{font-size:.74rem;color:#7c3a5a;margin-bottom:9px}',
      '#sc-lead input{width:100%;padding:8px 12px;margin-bottom:7px;border:1.5px solid rgba(233,30,140,.20);border-radius:10px;font-family:"Cairo",sans-serif;font-size:.87rem;color:#1a0510;background:#fff;outline:none;transition:border-color .2s}',
      '#sc-lead input:focus{border-color:#e91e8c}',
      '#sc-lead input::placeholder{color:#c4a4b4}',
      '#sc-hp{display:none!important}',
      '#sc-lead-btn{width:100%;padding:9px;background:linear-gradient(135deg,#e91e8c 0%,#880e4f 100%);color:#fff;border:none;border-radius:50px;font-family:"Cairo",sans-serif;font-size:.88rem;font-weight:700;cursor:pointer;transition:opacity .2s}',
      '#sc-lead-btn:hover{opacity:.88}',
      '#sc-lead-btn:disabled{opacity:.55;cursor:not-allowed}',

      /* Thanks */
      '#sc-thanks{background:#fff5f8;border-top:1.5px solid rgba(233,30,140,.10);padding:12px 14px;flex-shrink:0;text-align:center}',
      '#sc-thanks p{font-size:.83rem;color:#7c3a5a;margin-bottom:9px;line-height:1.6}',
      '#sc-wa{display:block;width:100%;padding:9px;background:#25D366;color:#fff;border:none;border-radius:50px;font-family:"Cairo",sans-serif;font-size:.88rem;font-weight:700;cursor:pointer;text-decoration:none;transition:opacity .2s}',
      '#sc-wa:hover{opacity:.88}',

      /* Input area */
      '#sc-inp-area{border-top:1px solid rgba(233,30,140,.08);padding:9px 11px;flex-shrink:0;background:#fff}',
      '#sc-chips{display:flex;gap:5px;flex-wrap:wrap;margin-bottom:7px}',
      '.sc-chip{background:#fce4ec;color:#880e4f;border:1px solid rgba(233,30,140,.18);border-radius:50px;padding:4px 11px;font-family:"Cairo",sans-serif;font-size:.72rem;font-weight:600;cursor:pointer;white-space:nowrap;transition:background .18s}',
      '.sc-chip:hover{background:#f48fb1;color:#fff}',
      '#sc-row{display:flex;gap:7px;align-items:center}',
      '#sc-in{flex:1;padding:9px 14px;border:1.5px solid rgba(233,30,140,.20);border-radius:50px;font-family:"Cairo",sans-serif;font-size:.88rem;color:#1a0510;background:#fff;outline:none;transition:border-color .2s}',
      '#sc-in:focus{border-color:#e91e8c}',
      '#sc-in::placeholder{color:#c4a4b4}',
      '#sc-send{width:38px;height:38px;border-radius:50%;background:linear-gradient(135deg,#e91e8c 0%,#880e4f 100%);border:none;color:#fff;font-size:1rem;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:opacity .2s}',
      '#sc-send:hover{opacity:.85}',
      '#sc-send:disabled{opacity:.45;cursor:not-allowed}',

      /* Hidden utility */
      '.sc-hidden{display:none!important}',

      /* Mobile */
      '@media(max-width:520px){',
      '#sc-root{bottom:16px;right:12px}',
      '#sc-btn{width:48px;height:48px}',
      '#sc-pulse{inset:-6px}',
      '#sc-panel{position:fixed;bottom:0;right:0;left:0;width:100%;height:52vh;min-height:320px;max-height:420px;border-radius:16px 16px 0 0;padding-bottom:env(safe-area-inset-bottom,0)}',
      '#sc-panel:not(.sc-hidden) ~ #sc-btn{display:none!important}',
      '#sc-nudge{position:fixed;bottom:76px;right:12px;left:12px;max-width:none;border-radius:10px}',
      '#sc-hd{padding:9px 12px}',
      '#sc-av{width:28px;height:28px}',
      '#sc-hd-name{font-size:.8rem}',
      '#sc-hd-status{font-size:.62rem}',
      '#sc-msgs{padding:8px 10px;gap:7px}',
      '.sc-m{font-size:.81rem;padding:7px 10px;max-width:88%}',
      '#sc-inp-area{padding:6px 8px}',
      '#sc-chips{gap:4px;margin-bottom:5px}',
      '.sc-chip{font-size:.67rem;padding:3px 8px}',
      '#sc-in{font-size:.82rem;padding:7px 11px}',
      '#sc-send{width:34px;height:34px;font-size:.9rem}',
      '#sc-lead,#sc-thanks{padding:10px 12px}',
      '#sc-lead-title{font-size:.82rem}',
      '#sc-lead-sub{font-size:.7rem}',
      '#sc-lead input{padding:7px 10px;font-size:.82rem;margin-bottom:5px}',
      '#sc-lead-btn,#sc-wa{padding:8px;font-size:.82rem}',
      '}',
    ].join('');
    document.head.appendChild(s);
  }

  /* ── DOM builder ─────────────────────────────────────────────────────── */
  function buildDOM() {
    var root = document.createElement('div');
    root.id = 'sc-root';
    root.setAttribute('dir', 'rtl');
    root.innerHTML =
      '<div id="sc-nudge" class="sc-hidden">' +
        '<span id="sc-nudge-txt"></span>' +
        '<button id="sc-nudge-x" aria-label="close">✕</button>' +
      '</div>' +

      '<div id="sc-panel" class="sc-hidden">' +
        '<div id="sc-hd">' +
          '<div id="sc-hd-left">' +
            '<img id="sc-av" src="/logo.png" alt="Solyra" onerror="this.style.opacity=0" />' +
            '<div><div id="sc-hd-name"></div><div id="sc-hd-status"></div></div>' +
          '</div>' +
          '<button id="sc-x" aria-label="close">✕</button>' +
        '</div>' +
        '<div id="sc-msgs">' +
          '<div id="sc-typing" class="sc-hidden"><span></span><span></span><span></span></div>' +
        '</div>' +
        '<div id="sc-lead" class="sc-hidden">' +
          '<div id="sc-lead-title"></div>' +
          '<div id="sc-lead-sub"></div>' +
          '<input id="sc-hp" name="website" tabindex="-1" autocomplete="off" />' +
          '<input id="sc-n" type="text" autocomplete="name" />' +
          '<input id="sc-p" type="tel" autocomplete="tel" />' +
          '<button id="sc-lead-btn"></button>' +
        '</div>' +
        '<div id="sc-thanks" class="sc-hidden">' +
          '<p id="sc-thanks-p"></p>' +
          '<a id="sc-wa" href="#" target="_blank" rel="noopener"></a>' +
        '</div>' +
        '<div id="sc-inp-area">' +
          '<div id="sc-chips"></div>' +
          '<div id="sc-row">' +
            '<input id="sc-in" type="text" />' +
            '<button id="sc-send" aria-label="send"></button>' +
          '</div>' +
        '</div>' +
      '</div>' +

      '<button id="sc-btn" aria-label="Chat with Solyra">' +
        '<div id="sc-pulse"></div>' +
        '<span id="sc-btn-icon">🌸</span>' +
        '<div id="sc-dot"></div>' +
        '<div id="sc-badge">1</div>' +
      '</button>';

    document.body.appendChild(root);
  }

  /* ── Set language ────────────────────────────────────────────────────── */
  function setLang(l) {
    lang = l || 'ar';
    var t = UI[lang] || UI.ar;
    var isRTL = lang === 'ar';
    var root = document.getElementById('sc-root');
    if (root) root.setAttribute('dir', isRTL ? 'rtl' : 'ltr');

    function set(id, val) { var el = document.getElementById(id); if (el) el.textContent = val; }
    set('sc-hd-name', t.headerName);
    set('sc-hd-status', t.headerStatus);
    set('sc-nudge-txt', t.nudge);
    set('sc-lead-title', t.leadTitle);
    set('sc-lead-sub', t.leadSub);
    set('sc-lead-btn', t.submitBtn);
    set('sc-wa', t.waBtn);

    var inEl = document.getElementById('sc-in');
    if (inEl) inEl.placeholder = t.placeholder;
    var nEl = document.getElementById('sc-n');
    if (nEl) nEl.placeholder = t.namePh;
    var pEl = document.getElementById('sc-p');
    if (pEl) pEl.placeholder = t.phonePh;
    var sendEl = document.getElementById('sc-send');
    if (sendEl) sendEl.textContent = t.sendIcon;

    buildChips(t.chips);
  }

  function buildChips(chips) {
    var container = document.getElementById('sc-chips');
    if (!container) return;
    container.innerHTML = '';
    chips.forEach(function(label) {
      var btn = document.createElement('button');
      btn.className = 'sc-chip';
      btn.textContent = label;
      btn.addEventListener('click', function() {
        container.classList.add('sc-hidden');
        send(label);
      });
      container.appendChild(btn);
    });
  }

  /* ── Message rendering ───────────────────────────────────────────────── */
  function addMsg(role, content) {
    var msgs = document.getElementById('sc-msgs');
    var typing = document.getElementById('sc-typing');
    var div = document.createElement('div');
    div.className = 'sc-m ' + role;
    div.textContent = content;
    msgs.insertBefore(div, typing);
    msgs.scrollTop = msgs.scrollHeight;
    return div;
  }

  function showTyping(show) {
    var t = document.getElementById('sc-typing');
    if (t) { if (show) t.classList.remove('sc-hidden'); else t.classList.add('sc-hidden'); }
    var msgs = document.getElementById('sc-msgs');
    if (msgs) msgs.scrollTop = msgs.scrollHeight;
  }

  /* ── Stream reply ────────────────────────────────────────────────────── */
  function streamReply(userText) {
    if (streaming) return;
    streaming = true;
    var sendBtn = document.getElementById('sc-send');
    if (sendBtn) sendBtn.disabled = true;
    showTyping(true);

    var bubble = null;
    var fullText = '';

    fetch(WORKER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: messages }),
    })
    .then(function(res) {
      if (!res.ok) throw new Error('HTTP ' + res.status);
      showTyping(false);

      var reader = res.body.getReader();
      var decoder = new TextDecoder();
      var buffer = '';

      function readChunk() {
        return reader.read().then(function(chunk) {
          if (chunk.done) return finishStream();

          buffer += decoder.decode(chunk.value, { stream: true });
          var lines = buffer.split('\n');
          buffer = lines.pop(); // keep incomplete line

          lines.forEach(function(line) {
            if (!line.startsWith('data: ')) return;
            var data = line.slice(6).trim();
            if (data === '[DONE]') return;
            try {
              var json = JSON.parse(data);
              var token = json.response || '';
              if (!token) return;
              fullText += token;
              if (!bubble) {
                bubble = addMsg('bot', token);
              } else {
                bubble.textContent = fullText;
                var msgs = document.getElementById('sc-msgs');
                if (msgs) msgs.scrollTop = msgs.scrollHeight;
              }
            } catch(e) {}
          });

          return readChunk();
        });
      }

      return readChunk();
    })
    .catch(function() {
      showTyping(false);
      var t = UI[lang] || UI.ar;
      addMsg('bot', t.error);
      fullText = t.error;
      finishStream();
    });

    function finishStream() {
      if (fullText) {
        messages.push({ role: 'assistant', content: fullText });
        msgCount++;
        saveSession();
        if (!leadShown && hasIntent(userText)) {
          setTimeout(showLeadForm, 700);
        }
      }
      streaming = false;
      var btn = document.getElementById('sc-send');
      if (btn) btn.disabled = false;
    }
  }

  /* ── Send message ────────────────────────────────────────────────────── */
  function send(text) {
    text = (text || '').trim();
    if (!text || streaming) return;

    var detected = detectLang(text);
    if (detected !== lang) setLang(detected);

    extractProfile(text);

    document.getElementById('sc-chips').classList.add('sc-hidden');
    document.getElementById('sc-badge').classList.add('sc-hidden');

    messages.push({ role: 'user', content: text });
    msgCount++;
    addMsg('user', text);
    saveSession();

    var inEl = document.getElementById('sc-in');
    if (inEl) inEl.value = '';

    streamReply(text);
  }

  /* ── Lead form ───────────────────────────────────────────────────────── */
  function showLeadForm() {
    if (leadShown) return;
    leadShown = true;
    var form = document.getElementById('sc-lead');
    if (form) form.classList.remove('sc-hidden');
    var msgs = document.getElementById('sc-msgs');
    if (msgs) msgs.scrollTop = msgs.scrollHeight;
  }

  function submitLead(name, phone) {
    var t = UI[lang] || UI.ar;
    var transcript = messages.slice(-6).map(function(m){
      return (m.role === 'user' ? '👤' : '🌸') + ' ' + m.content;
    }).join('\n');

    try {
      fetch(SUBMIT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name,
          phone: phone,
          service: '[Chatbot] ' + (profile.services.slice(0,2).join(', ') || 'طلب حجز'),
          eventId: 'ev_' + Date.now() + '_' + Math.random().toString(36).slice(2,7),
          userAgent: navigator.userAgent,
          eventSourceUrl: location.href,
          fbp: getCookie('_fbp'),
          fbc: getCookie('_fbc'),
          message: transcript,
        }),
      });
    } catch(e) {}

    /* Show thanks */
    document.getElementById('sc-lead').classList.add('sc-hidden');
    var thanks = document.getElementById('sc-thanks');
    var tp = document.getElementById('sc-thanks-p');
    var wa  = document.getElementById('sc-wa');
    if (tp) tp.textContent = t.thanksText;
    if (wa) {
      wa.textContent = t.waBtn;
      wa.href = 'https://wa.me/' + WA_NUMBER + '?text=' + t.waMsg(name);
    }
    if (thanks) thanks.classList.remove('sc-hidden');
    saveSession();
  }

  /* ── Toggle ──────────────────────────────────────────────────────────── */
  function toggle() {
    isOpen = !isOpen;
    var panel  = document.getElementById('sc-panel');
    var nudge  = document.getElementById('sc-nudge');
    var badge  = document.getElementById('sc-badge');
    var icon   = document.getElementById('sc-btn-icon');

    if (isOpen) {
      panel.classList.remove('sc-hidden');
      if (nudge) nudge.classList.add('sc-hidden');
      if (badge) badge.classList.add('sc-hidden');
      if (icon)  icon.textContent = '✕';

      if (messages.length === 0) {
        var t = UI[lang] || UI.ar;
        setTimeout(function() {
          showTyping(true);
          setTimeout(function() {
            showTyping(false);
            addMsg('bot', t.welcome);
            messages.push({ role: 'assistant', content: t.welcome });
            msgCount++;
            saveSession();
          }, 900);
        }, 250);
      }

      setTimeout(function() {
        var inEl = document.getElementById('sc-in');
        if (inEl) inEl.focus();
      }, 350);

    } else {
      panel.classList.add('sc-hidden');
      if (icon) icon.textContent = '🌸';
    }
  }

  /* ── Nudge ───────────────────────────────────────────────────────────── */
  function showNudge() {
    if (isOpen || messages.length > 0) return;
    var nudge = document.getElementById('sc-nudge');
    if (nudge) nudge.classList.remove('sc-hidden');
  }

  /* ── Wire events ─────────────────────────────────────────────────────── */
  function wireEvents() {
    document.getElementById('sc-btn').addEventListener('click', toggle);
    document.getElementById('sc-x').addEventListener('click', toggle);

    var nudgeTxt = document.getElementById('sc-nudge-txt');
    var nudgeX   = document.getElementById('sc-nudge-x');
    if (nudgeTxt) nudgeTxt.addEventListener('click', function(){ document.getElementById('sc-nudge').classList.add('sc-hidden'); toggle(); });
    if (nudgeX)   nudgeX.addEventListener('click', function(){ document.getElementById('sc-nudge').classList.add('sc-hidden'); });

    var inEl   = document.getElementById('sc-in');
    var sendBtn = document.getElementById('sc-send');
    if (inEl)    inEl.addEventListener('keydown', function(e){ if (e.key === 'Enter' && !e.shiftKey){ e.preventDefault(); send(inEl.value); } });
    if (sendBtn) sendBtn.addEventListener('click', function(){ send(document.getElementById('sc-in').value); });

    /* Lead form */
    var leadBtn = document.getElementById('sc-lead-btn');
    if (leadBtn) {
      leadBtn.addEventListener('click', function() {
        var hp   = document.getElementById('sc-hp');
        if (hp && hp.value) return; // honeypot triggered
        var name  = (document.getElementById('sc-n').value || '').trim();
        var phone = (document.getElementById('sc-p').value || '').trim();
        if (!name || !phone) return;
        leadBtn.disabled = true;
        profile.name  = name;
        profile.phone = phone;
        submitLead(name, phone);
      });
    }
  }

  /* ── Restore session messages ────────────────────────────────────────── */
  function restoreMessages() {
    messages.forEach(function(m){ addMsg(m.role, m.content); });
    if (messages.length > 0) {
      var div = document.createElement('div');
      div.className = 'sc-divider';
      div.textContent = (UI[lang] || UI.ar).resumedLabel;
      var msgs = document.getElementById('sc-msgs');
      if (msgs) msgs.insertBefore(div, msgs.firstChild);
      document.getElementById('sc-chips').classList.add('sc-hidden');
    }
  }

  /* ── Sync with site language switcher ───────────────────────────────── */
  function watchSiteLang() {
    // web.html sets document.documentElement.lang when user picks a language
    var observer = new MutationObserver(function(mutations) {
      mutations.forEach(function(m) {
        if (m.attributeName === 'lang') {
          var siteLang = document.documentElement.lang || 'ar';
          var mapped = siteLang === 'fr' ? 'fr' : siteLang === 'en' ? 'en' : 'ar';
          if (mapped !== lang) setLang(mapped);
        }
      });
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
  }

  /* ── Init ────────────────────────────────────────────────────────────── */
  function init() {
    injectCSS();
    buildDOM();

    // Start with whatever language the site is already showing
    var siteLang = document.documentElement.lang || localStorage.getItem('solyra_lang') || 'ar';
    setLang(siteLang === 'fr' ? 'fr' : siteLang === 'en' ? 'en' : 'ar');

    // Always start fresh on page load — no message history restored
    localStorage.removeItem(SESSION_KEY);

    wireEvents();
    watchSiteLang();
    setTimeout(showNudge, 6000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
