import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envPath = path.join(__dirname, '..', '.env');

const envVars = {};
if (fs.existsSync(envPath)) {
  const lines = fs.readFileSync(envPath, 'utf-8').split(/\r?\n/);
  for (const line of lines) {
    if (!line || line.startsWith('#')) continue;
    const idx = line.indexOf('=');
    if (idx > 0) {
      envVars[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
    }
  }
}

const APIFY_TOKEN = envVars.APIFY_API_TOKEN;
const DATACRAZY_WEBHOOK_URL = envVars.DATACRAZY_WEBHOOK_URL;

async function runHandshake() {
  console.log('=== ⚡ FASE 2: L - LINK (HANDSHAKE V.L.A.E.G.) ===\n');

  // 1. Testar Apify API
  try {
    const resp = await fetch(`https://api.apify.com/v2/users/me?token=${encodeURIComponent(APIFY_TOKEN)}`);
    const data = await resp.json();
    if (resp.ok && data.data) {
      console.log(`✅ [APIFY CONECTADA] Usuário: ${data.data.username} | Plano: ${data.data.plan?.id || 'Ativo'}`);
    } else {
      console.error('❌ [APIFY ERRO]:', data);
    }
  } catch (err) {
    console.error('❌ [APIFY FALHA DE REDE]:', err.message);
  }

  // 2. Testar Webhook DataCrazy enviando o payload completo para mapeamento na tela
  try {
    const samplePayload = {
      nome: 'Prime Garage Estetica Automotiva',
      empresa: 'Prime Garage Estetica Automotiva',
      email: 'contato@primegarage.com.br',
      ddi: '55',
      telefone: '31999887766',
      whatsapp_completo: '5531999887766',
      instagram: '@primegarage.detail',
      instagram_url: 'https://instagram.com/primegarage.detail',
      cidade: 'Belo Horizonte',
      uf: 'MG',
      pais: 'Brasil',
      origem: 'Prospeccao Ativa Apify',
      nicho: 'Estetica Automotiva & Detailing',
      potencial_fechamento: 'ALTO',
      score_fechamento: 95,
      motivo_potencial: 'Nao anuncia na Meta Ads + Possui WhatsApp direto na bio + Perfil automotivo ativo',
      esta_na_biblioteca_meta: 'Nao esta na Biblioteca',
      anuncios_ativos_meta: 0,
      prioridade: 'ALTA',
      link_biblioteca_meta: 'https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=BR&q=primegarage.detail'
    };

    const dcResp = await fetch(DATACRAZY_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(samplePayload)
    });

    const dcText = await dcResp.text();
    if (dcResp.ok) {
      console.log(`✅ [DATACRAZY WEBHOOK CONECTADO] Status ${dcResp.status}: ${dcText}`);
    } else {
      console.error(`❌ [DATACRAZY ERRO] Status ${dcResp.status}: ${dcText}`);
    }
  } catch (err) {
    console.error('❌ [DATACRAZY FALHA DE REDE]:', err.message);
  }
}

runHandshake();
