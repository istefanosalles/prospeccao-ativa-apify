import fs from 'fs';
import path from 'path';

let WA_SOCK = null;
let WA_STATE = {
  status: 'disconnected', // 'disconnected' | 'connecting' | 'qr_ready' | 'connected'
  qrDataUrl: '',
  connectedPhone: '',
  connectedName: '',
  lastError: '',
  updatedAt: null
};

let WA_QUEUE = {
  running: false,
  total: 0,
  sent: 0,
  failed: 0,
  currentLead: '',
  nextSendAt: null,
  logs: []
};

let STOP_QUEUE_FLAG = false;

export function getWhatsAppStatus() {
  return {
    state: WA_STATE,
    queue: WA_QUEUE
  };
}

export async function disconnectWhatsApp(authDir) {
  try {
    if (WA_SOCK) {
      await WA_SOCK.logout().catch(() => {});
      WA_SOCK.end(undefined);
      WA_SOCK = null;
    }
  } catch {}
  if (authDir && fs.existsSync(authDir)) {
    try {
      fs.rmSync(authDir, { recursive: true, force: true });
    } catch {}
  }
  WA_STATE = {
    status: 'disconnected',
    qrDataUrl: '',
    connectedPhone: '',
    connectedName: '',
    lastError: '',
    updatedAt: new Date().toISOString()
  };
  return WA_STATE;
}

export async function startWhatsAppQrSession(authDir) {
  if (WA_STATE.status === 'connected' && WA_SOCK) {
    return WA_STATE;
  }

  WA_STATE.status = 'connecting';
  WA_STATE.lastError = '';
  WA_STATE.updatedAt = new Date().toISOString();

  try {
    if (!fs.existsSync(authDir)) {
      fs.mkdirSync(authDir, { recursive: true });
    }

    const baileys = await import('@whiskeysockets/baileys');
    const QRCode = (await import('qrcode')).default;
    const pino = (await import('pino')).default;

    const makeWASocket = baileys.default?.default || baileys.default || baileys.makeWASocket;
    const { useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = baileys;

    const { state, saveCreds } = await useMultiFileAuthState(authDir);
    let version = [2, 3000, 1015901307];
    try {
      const latest = await fetchLatestBaileysVersion();
      if (latest && latest.version) version = latest.version;
    } catch {}

    if (WA_SOCK) {
      try { WA_SOCK.end(undefined); } catch {}
      WA_SOCK = null;
    }

    const sock = makeWASocket({
      version,
      auth: state,
      printQRInTerminal: false,
      logger: pino({ level: 'silent' }),
      browser: ['Salles Prospector', 'Chrome', '120.0.0'],
      syncFullHistory: false,
      markOnlineOnConnect: false
    });

    WA_SOCK = sock;
    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        try {
          const dataUrl = await QRCode.toDataURL(qr, { width: 280, margin: 2 });
          WA_STATE.status = 'qr_ready';
          WA_STATE.qrDataUrl = dataUrl;
          WA_STATE.updatedAt = new Date().toISOString();
        } catch (err) {
          WA_STATE.lastError = 'Erro ao gerar imagem do QR Code: ' + err.message;
        }
      }

      if (connection === 'open') {
        const rawId = String(sock.user?.id || '');
        const cleanPhone = rawId.split(':')[0].split('@')[0];
        WA_STATE.status = 'connected';
        WA_STATE.qrDataUrl = '';
        WA_STATE.connectedPhone = cleanPhone;
        WA_STATE.connectedName = sock.user?.name || 'WhatsApp Conectado';
        WA_STATE.lastError = '';
        WA_STATE.updatedAt = new Date().toISOString();
      }

      if (connection === 'close') {
        const statusCode = lastDisconnect?.error?.output?.statusCode;
        const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

        if (statusCode === DisconnectReason.loggedOut) {
          try {
            fs.rmSync(authDir, { recursive: true, force: true });
          } catch {}
          WA_STATE.status = 'disconnected';
          WA_STATE.qrDataUrl = '';
          WA_STATE.connectedPhone = '';
          WA_STATE.connectedName = '';
          WA_STATE.lastError = 'Sessão desconectada pelo celular.';
        } else if (shouldReconnect) {
          setTimeout(() => {
            startWhatsAppQrSession(authDir).catch(() => {});
          }, 2500);
        } else {
          WA_STATE.status = 'disconnected';
        }
      }
    });

    return WA_STATE;
  } catch (err) {
    WA_STATE.status = 'disconnected';
    WA_STATE.lastError = err.message;
    throw err;
  }
}

export async function sendWhatsAppDirectMessage({ phone, message, apiConfig = {} }) {
  const cleanDigits = String(phone || '').replace(/\D/g, '');
  if (!cleanDigits || cleanDigits.length < 10) {
    throw new Error('Número de WhatsApp inválido ou ausente.');
  }
  const normalizedPhone = cleanDigits.startsWith('55') ? cleanDigits : `55${cleanDigits}`;

  // 1. Envio via QR Code conectado localmente (Baileys)
  if (WA_STATE.status === 'connected' && WA_SOCK) {
    let targetJid = `${normalizedPhone}@s.whatsapp.net`;

    // No Brasil (especialmente DDDs 31-99), o WhatsApp às vezes registra o número sem o 9º dígito.
    // O onWhatsApp descobre exatamente qual JID existe no servidor do WhatsApp!
    try {
      const candidates = [normalizedPhone];
      if (normalizedPhone.length === 13 && normalizedPhone.startsWith('55') && normalizedPhone[4] === '9') {
        candidates.push(normalizedPhone.slice(0, 4) + normalizedPhone.slice(5));
      }
      for (const cand of candidates) {
        const check = await WA_SOCK.onWhatsApp(cand);
        if (Array.isArray(check) && check[0]?.exists && check[0]?.jid) {
          targetJid = check[0].jid;
          break;
        }
      }
    } catch {}

    // Simular "Digitando..." humano por 2.2 segundos
    try {
      await WA_SOCK.sendPresenceUpdate('composing', targetJid);
      await new Promise((r) => setTimeout(r, 2200));
    } catch {}

    await WA_SOCK.sendMessage(targetJid, { text: message });

    try {
      await WA_SOCK.sendPresenceUpdate('paused', targetJid);
    } catch {}

    return {
      ok: true,
      mode: 'qr_code_direto',
      phone: normalizedPhone,
      jid: targetJid
    };
  }

  // 2. Fallback: Envio via API Externa / Webhook na Nuvem (Evolution API, Z-API, Uazapi ou Webhook customizado)
  if (apiConfig && apiConfig.apiUrl) {
    const headers = { 'Content-Type': 'application/json' };
    if (apiConfig.apiToken) {
      headers['apikey'] = apiConfig.apiToken;
      headers['Authorization'] = `Bearer ${apiConfig.apiToken}`;
    }

    const bodyPayload = {
      number: normalizedPhone,
      phone: normalizedPhone,
      text: message,
      message,
      textMessage: { text: message }
    };

    const res = await fetch(apiConfig.apiUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(bodyPayload)
    });

    if (!res.ok) {
      const errTxt = await res.text().catch(() => '');
      throw new Error(`Erro na API de WhatsApp (${res.status}): ${errTxt.slice(0, 120)}`);
    }

    return {
      ok: true,
      mode: 'api_nuvem',
      phone: normalizedPhone
    };
  }

  throw new Error('Conecte seu WhatsApp lendo o QR Code no botão "📲 Disparador WhatsApp" no topo (ou configure uma API externa).');
}

export function stopBulkQueue() {
  STOP_QUEUE_FLAG = true;
  WA_QUEUE.running = false;
  WA_QUEUE.nextSendAt = null;
  WA_QUEUE.logs.unshift(`[${new Date().toLocaleTimeString('pt-BR')}] ⏹️ Fila interrompida pelo usuário.`);
  return WA_QUEUE;
}

export async function startBulkQueue({ leads = [], delayMinSec = 25, delayMaxSec = 45, apiConfig = {}, onLeadSent }) {
  if (WA_QUEUE.running) {
    throw new Error('Já existe uma fila de disparo em andamento!');
  }

  const validLeads = leads.filter((l) => l.contact?.whatsapp_number && l.contact?.personalized_message);
  if (validLeads.length === 0) {
    throw new Error('Nenhum lead selecionado possui número de WhatsApp válido.');
  }

  STOP_QUEUE_FLAG = false;
  WA_QUEUE = {
    running: true,
    total: validLeads.length,
    sent: 0,
    failed: 0,
    currentLead: validLeads[0]?.instagram?.username || '',
    nextSendAt: new Date().toISOString(),
    logs: [`[${new Date().toLocaleTimeString('pt-BR')}] 🚀 Iniciando fila automática para ${validLeads.length} leads...`]
  };

  (async () => {
    for (let i = 0; i < validLeads.length; i++) {
      if (STOP_QUEUE_FLAG) break;
      const lead = validLeads[i];
      WA_QUEUE.currentLead = `@${lead.instagram.username}`;

      try {
        await sendWhatsAppDirectMessage({
          phone: lead.contact.whatsapp_number,
          message: lead.contact.personalized_message,
          apiConfig
        });
        WA_QUEUE.sent++;
        WA_QUEUE.logs.unshift(`[${new Date().toLocaleTimeString('pt-BR')}] ✅ Enviado para @${lead.instagram.username} (${lead.contact.whatsapp_number})`);
        if (typeof onLeadSent === 'function') {
          await onLeadSent(lead.id, true);
        }
      } catch (err) {
        WA_QUEUE.failed++;
        WA_QUEUE.logs.unshift(`[${new Date().toLocaleTimeString('pt-BR')}] ❌ Falha em @${lead.instagram.username}: ${err.message}`);
      }

      // Delay anti-bloqueio entre mensagens (se ainda houver próximo lead)
      if (i < validLeads.length - 1 && !STOP_QUEUE_FLAG) {
        const minMs = Math.max(Number(delayMinSec) || 20, 8) * 1000;
        const maxMs = Math.max(Number(delayMaxSec) || 40, minMs / 1000 + 5) * 1000;
        const waitMs = Math.floor(minMs + Math.random() * (maxMs - minMs));
        WA_QUEUE.nextSendAt = new Date(Date.now() + waitMs).toISOString();
        WA_QUEUE.logs.unshift(`[${new Date().toLocaleTimeString('pt-BR')}] ⏳ Aguardando ${Math.round(waitMs / 1000)}s (delay anti-bloqueio)...`);
        await new Promise((r) => setTimeout(r, waitMs));
      }
    }

    WA_QUEUE.running = false;
    WA_QUEUE.currentLead = '';
    WA_QUEUE.nextSendAt = null;
    WA_QUEUE.logs.unshift(`[${new Date().toLocaleTimeString('pt-BR')}] 🎉 Fila concluída! (${WA_QUEUE.sent} enviados, ${WA_QUEUE.failed} falhas)`);
  })();

  return WA_QUEUE;
}
