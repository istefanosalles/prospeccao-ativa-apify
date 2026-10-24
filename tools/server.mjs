import fs from 'fs';
import path from 'path';
import http from 'http';
import { fileURLToPath } from 'url';
import {
  extractPhone,
  parseGoogleInstagramResults,
  checkProfileHealth,
  resolveBioLinkWhatsApp,
  parseMetaAdsResultForProfile,
  qualifyLead,
  generateFirstMessageStrategy,
  buildProspectLead,
  sendLeadToDataCrazy
} from './prospector_engine.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.join(__dirname, '..');
const IS_VERCEL = Boolean(process.env.VERCEL);
const SEED_TMP_DIR = path.join(ROOT_DIR, '.tmp');
const TMP_DIR = IS_VERCEL ? '/tmp/salles-prospector' : SEED_TMP_DIR;
const ENV_PATH = path.join(ROOT_DIR, '.env');
const UI_PATH = path.join(__dirname, 'dashboard.html');
const DB_PATH = path.join(TMP_DIR, 'leads_database.json');
const CONFIG_PATH = path.join(TMP_DIR, 'config_database.json');
const USERS_DB_PATH = path.join(TMP_DIR, 'users_database.json');
const SEED_DB_PATH = path.join(SEED_TMP_DIR, 'leads_database.json');
const SEED_USERS_PATH = path.join(SEED_TMP_DIR, 'users_database.json');

if (!fs.existsSync(TMP_DIR)) {
  fs.mkdirSync(TMP_DIR, { recursive: true });
}
if (IS_VERCEL && !fs.existsSync(DB_PATH) && fs.existsSync(SEED_DB_PATH)) {
  fs.copyFileSync(SEED_DB_PATH, DB_PATH);
}
if (IS_VERCEL && !fs.existsSync(USERS_DB_PATH) && fs.existsSync(SEED_USERS_PATH)) {
  fs.copyFileSync(SEED_USERS_PATH, USERS_DB_PATH);
}

function loadEnv() {
  const envVars = {
    APIFY_API_TOKEN: process.env.APIFY_API_TOKEN || '',
    DATACRAZY_WEBHOOK_URL: process.env.DATACRAZY_WEBHOOK_URL || '',
    SUPABASE_URL: process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '',
    SUPABASE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_KEY || ''
  };
  if (fs.existsSync(ENV_PATH)) {
    const lines = fs.readFileSync(ENV_PATH, 'utf-8').split(/\r?\n/);
    for (const line of lines) {
      if (!line || line.startsWith('#')) continue;
      const idx = line.indexOf('=');
      if (idx > 0) {
        const k = line.slice(0, idx).trim();
        const v = line.slice(idx + 1).trim();
        envVars[k] = v;
      }
    }
  }
  envVars.SUPABASE_URL = (envVars.SUPABASE_URL || envVars.VITE_SUPABASE_URL || '').replace(/\/$/, '');
  envVars.SUPABASE_KEY = envVars.SUPABASE_SERVICE_ROLE_KEY || envVars.SUPABASE_ANON_KEY || envVars.SUPABASE_KEY || '';
  return envVars;
}

function isSupabaseActive() {
  const env = loadEnv();
  return Boolean(env.SUPABASE_URL && env.SUPABASE_KEY && env.SUPABASE_URL.startsWith('https://'));
}

async function syncUsersToSupabase(usersDb) {
  if (!isSupabaseActive()) return false;
  const env = loadEnv();
  try {
    const rows = (usersDb.users || []).map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      password: u.password || '123',
      onboarding_completed: Boolean(u.onboardingCompleted),
      preferences: u.preferences || {},
      leads: u.leads || [],
      history: u.history || [],
      deleted_usernames: u.deletedUsernames || [],
      config: u.config || {},
      updated_at: new Date().toISOString()
    }));

    await fetch(`${env.SUPABASE_URL}/rest/v1/prospector_users?on_conflict=id`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: env.SUPABASE_KEY,
        Authorization: `Bearer ${env.SUPABASE_KEY}`,
        Prefer: 'resolution=merge-duplicates'
      },
      body: JSON.stringify(rows)
    });

    // Também espelha cada lead individualmente na tabela relacional prospect_leads
    const allLeadsRows = [];
    for (const u of usersDb.users || []) {
      for (const l of u.leads || []) {
        allLeadsRows.push({
          id: `${u.id}__${l.id}`,
          user_id: u.id,
          niche_id: l.niche_id || 'geral',
          niche_name: l.niche_name || 'Geral',
          location: l.location || 'Brasil',
          username: l.instagram?.username || '',
          full_name: l.instagram?.full_name || '',
          profile_url: l.instagram?.profile_url || '',
          followers_count: Number(l.instagram?.followers_count || 0),
          biography: l.instagram?.biography || '',
          external_url: l.instagram?.external_url || '',
          in_ad_library: Boolean(l.meta_ads?.in_ad_library),
          active_ads_count: Number(l.meta_ads?.active_ads_count || 0),
          ad_library_status_label: l.meta_ads?.ad_library_status_label || '',
          ad_library_url: l.meta_ads?.ad_library_url || '',
          priority: l.qualification?.priority || 'ALTA',
          closing_potential: l.qualification?.closing_potential || 'ALTO',
          closing_score: Number(l.qualification?.closing_score || 0),
          closing_reason: l.qualification?.closing_reason || '',
          whatsapp_number: l.contact?.whatsapp_number || '',
          whatsapp_link: l.contact?.whatsapp_link || '',
          personalized_message: l.contact?.personalized_message || '',
          pipeline_status: l.pipeline_status || 'novo',
          updated_at: new Date().toISOString()
        });
      }
    }

    if (allLeadsRows.length > 0) {
      await fetch(`${env.SUPABASE_URL}/rest/v1/prospect_leads?on_conflict=id`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: env.SUPABASE_KEY,
          Authorization: `Bearer ${env.SUPABASE_KEY}`,
          Prefer: 'resolution=merge-duplicates'
        },
        body: JSON.stringify(allLeadsRows)
      });
    }
    return true;
  } catch (err) {
    console.warn('Aviso ao sincronizar com Supabase:', err.message);
    return false;
  }
}

let LAST_SUPABASE_PULL = 0;
async function pullUsersFromSupabaseIfConfigured(force = false) {
  if (!isSupabaseActive()) return;
  if (!force && Date.now() - LAST_SUPABASE_PULL < 4000) return;
  LAST_SUPABASE_PULL = Date.now();
  const env = loadEnv();
  try {
    const resp = await fetch(`${env.SUPABASE_URL}/rest/v1/prospector_users?select=*&order=created_at.asc`, {
      headers: {
        apikey: env.SUPABASE_KEY,
        Authorization: `Bearer ${env.SUPABASE_KEY}`
      }
    });
    if (!resp.ok) return;
    const rows = await resp.json();
    if (Array.isArray(rows) && rows.length > 0) {
      const users = rows.map((r) => ({
        id: r.id,
        name: r.name,
        email: r.email,
        password: r.password || '123',
        onboardingCompleted: Boolean(r.onboarding_completed),
        preferences: r.preferences || {},
        leads: Array.isArray(r.leads) ? r.leads : [],
        history: Array.isArray(r.history) ? r.history : [],
        deletedUsernames: Array.isArray(r.deleted_usernames) ? r.deleted_usernames : [],
        config: r.config || loadConfig()
      }));
      fs.writeFileSync(USERS_DB_PATH, JSON.stringify({ users }, null, 2), 'utf-8');
    } else if (Array.isArray(rows) && rows.length === 0) {
      // Banco recém-criado no Supabase: envia a carga inicial
      const localDb = loadUsersDb();
      await syncUsersToSupabase(localDb);
    }
  } catch (err) {
    console.warn('Aviso ao ler do Supabase:', err.message);
  }
}

const DEFAULT_NICHES = [
  {
    id: 'automotivo-estetica',
    name: 'Estética Automotiva & Detailing',
    category: 'Automotivo',
    keywords: ['estetica automotiva', 'polimento automotivo', 'vitrificacao automotiva', 'detailing'],
    defaultMessage: 'Olá, {nome}! Vi o perfil @{username} no Instagram e achei o trabalho de estética automotiva de vocês impecável. Notei que vocês não estão com anúncios ativos na Biblioteca da Meta hoje para atrair donos de carros da região todos os dias. Posso te mostrar rapidinho como geramos orçamentos diários de vitrificação e polimento direto no WhatsApp?'
  },
  {
    id: 'automotivo-revenda',
    name: 'Loja de Veículos & Seminovos',
    category: 'Automotivo',
    keywords: ['seminovos', 'multimarcas', 'loja de carros', 'veiculos seminovos'],
    defaultMessage: 'Fala, {nome}! Acompanhei o estoque da @{username} no Instagram e vi que têm ótimos veículos, mas reparei na Biblioteca de Anúncios da Meta que vocês não estão rodando campanhas ativas hoje. Estamos ajudando lojas de seminovos a receberem leads qualificados querendo financiar ou trocar de carro direto no WhatsApp. Faz sentido conversarmos 2 minutinhos?'
  },
  {
    id: 'automotivo-oficina',
    name: 'Oficina Mecânica & Centro Automotivo',
    category: 'Automotivo',
    keywords: ['oficina mecanica', 'centro automotivo', 'cambio automatico', 'injecao eletronica'],
    defaultMessage: 'Olá, {nome}! Vi a estrutura da @{username} no Instagram, parabéns pelo trabalho! Verifiquei na Biblioteca da Meta e vi que vocês não estão com anúncios ativos no momento. Nós ajudamos centros automotivos a lotarem a agenda da semana com serviços de maior ticket. Posso te mandar um áudio rápido explicando como funciona?'
  },
  {
    id: 'automotivo-som-pelicula',
    name: 'Insulfilm, Som & Acessórios Automotivos',
    category: 'Automotivo',
    keywords: ['insulfilm', 'pelicula automotiva', 'som automotivo', 'envelopamento automotivo'],
    defaultMessage: 'Tudo bem, {nome}? Vi os projetos da @{username} no Instagram! Notei que vocês não estão anunciando na Biblioteca da Meta agora. Temos uma estratégia específica para estética e acessórios automotivos que traz orçamentos diários no WhatsApp. Posso te explicar como aplicamos na sua região?'
  },
  {
    id: 'clinica-odontologia',
    name: 'Clínicas Odontológicas & Estética',
    category: 'Saúde & Estética',
    keywords: ['clinica odontologica', 'implantes dentarios', 'lentes de contato dental', 'harmonizacao facial'],
    defaultMessage: 'Olá, {nome}! Vi o perfil @{username} no Instagram e achei excelente a estrutura da clínica. Notei na Biblioteca da Meta que vocês não estão com campanhas ativas hoje. Posso te mostrar como geramos agendamentos de avaliação pelo WhatsApp?'
  },
  {
    id: 'imobiliaria-corretores',
    name: 'Imobiliárias & Alto Padrão',
    category: 'Imobiliário',
    keywords: ['imobiliaria', 'imoveis alto padrao', 'construtora', 'lancamentos imobiliarios'],
    defaultMessage: 'Olá, {nome}! Vi o portfólio da @{username} no Instagram. Reparei que vocês não estão rodando tráfego ativo na Biblioteca da Meta hoje. Posso te mostrar como estamos captando compradores qualificados para imóveis na região?'
  }
];

function getInitialLeads() {
  const nicheEstetica = DEFAULT_NICHES[0];
  const nicheRevenda = DEFAULT_NICHES[1];
  const nicheOficina = DEFAULT_NICHES[2];

  return [
    buildProspectLead({
      username: 'escola_da_estetica_automotiv',
      full_name: 'ESCOLA DA ESTÉTICA AUTOMOTIVA',
      biography: '🚨 ESCOLA DA ESTÉTICA AUTOMOTIVA\n🧑🏻‍🎓Treinamento Profissional\n🚀Cursos 100% práticos\n🇧🇷 EM TODO BRASIL + 15MIL Alunos formados\n👇Garanta sua vaga',
      external_url: 'https://wa.me/5519995332083?countryName=BR&countryCode=55&phoneNumber=19995332083',
      followers_count: 35836,
      whatsapp_number: '5519995332083',
      in_ad_library: false,
      active_ads_count: 0,
      location: 'Campinas - SP',
      checked_at: '2026-10-22T22:59:14Z'
    }, nicheEstetica, 'Campinas - SP'),
    buildProspectLead({
      username: 'eduardoesteticape',
      full_name: 'EDUARDO DETAILER 🧙',
      biography: '🪪CREDENCIADO @dimensioncustoms\n♦️Vitrificação ♦️PPF ♦️Películas fumê premium ♦️Lavagem detalhada\n0️⃣0️⃣ da região 🏅',
      external_url: 'https://minhaautoagenda.com/p/eduardoagenda',
      followers_count: 7216,
      whatsapp_number: '',
      in_ad_library: false,
      active_ads_count: 0,
      location: 'Recife - PE',
      checked_at: '2026-10-22T22:59:14Z'
    }, nicheEstetica, 'Recife - PE'),
    buildProspectLead({
      username: 'ulbrichspaautomotivo',
      full_name: 'Ulbrich Spa Automotivo',
      biography: 'Especialistas em proteção de 0km & Renovação de seminovo.\n▪️PPF •Vitrificação •Películas •Polimento\nFale com um especialista👇',
      external_url: 'https://linkbio.co/ulbrichesteticaautomotiva',
      followers_count: 15967,
      whatsapp_number: '',
      in_ad_library: false,
      active_ads_count: 0,
      location: 'Curitiba - PR',
      checked_at: '2026-10-22T22:59:14Z'
    }, nicheEstetica, 'Curitiba - PR'),
    buildProspectLead({
      username: 'primegarage.detail',
      full_name: 'Prime Garage Estética Automotiva',
      biography: '✨ Especialistas em Vitrificação 9H, Polimento Técnico e PPF.\n📍 BH / Savassi\n👇 Orçamentos no WhatsApp: (31) 99988-7766',
      external_url: 'https://wa.me/5531999887766',
      followers_count: 4820,
      whatsapp_number: '5531999887766',
      in_ad_library: false,
      active_ads_count: 0,
      location: 'Belo Horizonte - MG',
      datacrazy_synced: true,
      datacrazy_synced_at: '2026-10-22T22:53:44Z'
    }, nicheEstetica, 'Belo Horizonte - MG'),
    buildProspectLead({
      username: 'autoville.seminovos',
      full_name: 'Autoville Multimarcas & Seminovos',
      biography: '🚗 Seminovos periciados com garantia.\n💰 Financiamento em até 60x.\n📲 Fale com nossos consultores: (62) 99654-3210',
      external_url: 'https://wa.me/5562996543210',
      followers_count: 11300,
      whatsapp_number: '5562996543210',
      in_ad_library: false,
      active_ads_count: 0,
      location: 'Goiânia - GO'
    }, nicheRevenda, 'Goiânia - GO'),
    buildProspectLead({
      username: 'torquecentroautomotivo',
      full_name: 'Torque Centro Automotivo Especializado',
      biography: '🔧 Revisão Premium, Câmbio Automático, Suspensão e Freios.\n📞 WhatsApp Orçamentos: (41) 99812-4455',
      external_url: 'https://wa.me/5541998124455',
      followers_count: 3190,
      whatsapp_number: '5541998124455',
      in_ad_library: false,
      active_ads_count: 0,
      location: 'Curitiba - PR'
    }, nicheOficina, 'Curitiba - PR'),
    buildProspectLead({
      username: 'studiov8detail',
      full_name: 'Studio V8 Detailing & PPF',
      biography: '🏎️ Proteção de Pintura PPF & Ceramic Coating\n📍 Moema - SP\n📲 WhatsApp: (11) 99123-4567',
      external_url: 'https://wa.me/5511991234567',
      followers_count: 19400,
      whatsapp_number: '5511991234567',
      in_ad_library: true,
      active_ads_count: 7,
      location: 'São Paulo - SP'
    }, nicheEstetica, 'São Paulo - SP')
  ];
}

function loadDatabase() {
  if (!fs.existsSync(DB_PATH)) {
    const initial = { leads: getInitialLeads(), history: [] };
    fs.writeFileSync(DB_PATH, JSON.stringify(initial, null, 2), 'utf-8');
    return initial;
  }
  try {
    const parsed = JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'));
    let updated = false;

    // Mapa de WhatsApps extraídos de Linktrees conhecidos na base
    const knownLinktreePhones = {
      rivercarpnz: '5587988773276',
      petrolinaseminovos: '5587992024991'
    };

    // Contas abandonadas ou já excluídas pelo usuário
    const deletedSet = new Set([
      'seminovostoyolexpnz',
      ...((parsed.deletedUsernames || []).map((u) => String(u).toLowerCase()))
    ]);
    parsed.deletedUsernames = Array.from(deletedSet);

    const filteredLeads = (parsed.leads || []).filter((lead) => {
      const uName = String(lead.instagram?.username || '').toLowerCase();
      if (deletedSet.has(uName)) {
        updated = true;
        return false;
      }
      const health = checkProfileHealth(
        {
          username: lead.instagram?.username,
          full_name: lead.instagram?.full_name,
          biography: lead.instagram?.biography,
          external_url: lead.instagram?.external_url,
          whatsapp_number: lead.contact?.whatsapp_number,
          followers_count: lead.instagram?.followers_count
        },
        { id: lead.niche_id, name: lead.niche_name },
        lead.location
      );
      if (!health.isHealthy) {
        updated = true;
        return false;
      }
      return true;
    });

    parsed.leads = filteredLeads.map((lead) => {
      updated = true;
      const uName = String(lead.instagram?.username || '').toLowerCase();

      // Remover telefones fixos (sem dígito 9 após DDD) que tenham entrado antes
      let wa = String(lead.contact?.whatsapp_number || '').replace(/\D/g, '');
      if (wa.length === 12 && wa.startsWith('55') && wa[4] !== '9') {
        wa = '';
      }
      if (!wa && knownLinktreePhones[uName]) {
        wa = knownLinktreePhones[uName];
      }
      lead.contact.whatsapp_number = wa;

      lead.qualification = qualifyLead({
        inAdLibrary: lead.meta_ads?.in_ad_library,
        activeAdsCount: lead.meta_ads?.active_ads_count,
        whatsappNumber: wa,
        followersCount: lead.instagram?.followers_count,
        biography: lead.instagram?.biography
      });

      const strat = generateFirstMessageStrategy({
        fullName: lead.instagram?.full_name,
        username: lead.instagram?.username,
        nicheId: lead.niche_id,
        nicheName: lead.niche_name,
        location: lead.location,
        biography: lead.instagram?.biography,
        inAdLibrary: lead.meta_ads?.in_ad_library,
        activeAdsCount: lead.meta_ads?.active_ads_count,
        whatsappNumber: wa,
        followersCount: lead.instagram?.followers_count
      });
      lead.message_strategy = strat;
      lead.contact.personalized_message = strat.first_message;
      lead.contact.whatsapp_link = wa
        ? `https://wa.me/${wa}?text=${encodeURIComponent(strat.first_message)}`
        : `https://ig.me/m/${lead.instagram.username}`;
      return lead;
    });
    if (updated) {
      fs.writeFileSync(DB_PATH, JSON.stringify(parsed, null, 2), 'utf-8');
    }
    return parsed;
  } catch {
    return { leads: getInitialLeads(), history: [] };
  }
}

function saveDatabase(db) {
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2), 'utf-8');
}

function loadConfig() {
  const env = loadEnv();
  const defaultTrigger = {
    enabled: false,
    intervalHours: 24,
    nicheId: 'automotivo-revenda',
    keyword: 'seminovos',
    location: 'Petrolina - PE',
    limit: 6,
    autoSendDataCrazy: true,
    lastRunAt: null,
    nextRunAt: null
  };
  if (!fs.existsSync(CONFIG_PATH)) {
    const cfg = {
      niches: DEFAULT_NICHES,
      selectedNicheId: 'automotivo-estetica',
      autoSendDataCrazy: false,
      datacrazyWebhookUrl: env.DATACRAZY_WEBHOOK_URL || '',
      apifyConnected: Boolean(env.APIFY_API_TOKEN),
      trigger: defaultTrigger
    };
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2), 'utf-8');
    return cfg;
  }
  try {
    const cfg = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
    cfg.datacrazyWebhookUrl = cfg.datacrazyWebhookUrl || env.DATACRAZY_WEBHOOK_URL || '';
    cfg.apifyConnected = Boolean(env.APIFY_API_TOKEN);
    cfg.trigger = { ...defaultTrigger, ...(cfg.trigger || {}) };
    return cfg;
  } catch {
    return { niches: DEFAULT_NICHES, selectedNicheId: 'automotivo-estetica', trigger: defaultTrigger };
  }
}

function saveConfig(cfg) {
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2), 'utf-8');
}

function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', () => {
      if (!body) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch (e) {
        reject(e);
      }
    });
  });
}

function sendJson(res, status, obj) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-User-Id'
  });
  res.end(JSON.stringify(obj));
}

// ============================================================================
// SISTEMA MULTI-USUÁRIO (Login + Isolamento de Pesquisa + Onboarding Inicial)
// ============================================================================
function loadUsersDb() {
  const baseDb = loadDatabase();
  const baseCfg = loadConfig();
  const defaultSallesUser = {
    id: 'user-salles',
    name: 'Istêfano Salles',
    email: 'salles@salles.ia',
    password: '123',
    onboardingCompleted: true,
    preferences: {
      category: 'Automotivo',
      nicheName: 'Loja de Veículos & Seminovos',
      keyword: 'seminovos',
      location: 'Petrolina - PE'
    },
    leads: baseDb.leads || [],
    history: baseDb.history || [],
    deletedUsernames: baseDb.deletedUsernames || [],
    config: baseCfg
  };

  if (!fs.existsSync(USERS_DB_PATH)) {
    const initialUsers = { users: [defaultSallesUser] };
    fs.writeFileSync(USERS_DB_PATH, JSON.stringify(initialUsers, null, 2), 'utf-8');
    return initialUsers;
  }
  try {
    const parsed = JSON.parse(fs.readFileSync(USERS_DB_PATH, 'utf-8'));
    if (!Array.isArray(parsed.users) || parsed.users.length === 0) {
      parsed.users = [defaultSallesUser];
    }
    return parsed;
  } catch {
    return { users: [defaultSallesUser] };
  }
}

function saveUsersDb(usersDb) {
  fs.writeFileSync(USERS_DB_PATH, JSON.stringify(usersDb, null, 2), 'utf-8');
  syncUsersToSupabase(usersDb).catch(() => {});
}

function getUserContext(req, explicitUserId = '') {
  const usersDb = loadUsersDb();
  const headerUserId = explicitUserId || req.headers['x-user-id'] || 'user-salles';
  let user = usersDb.users.find((u) => u.id === headerUserId);
  if (!user) {
    user = usersDb.users[0];
  }
  const env = loadEnv();
  user.config = user.config || loadConfig();
  user.config.apifyConnected = Boolean(env.APIFY_API_TOKEN);
  user.config.supabaseConnected = isSupabaseActive();
  user.config.datacrazyWebhookUrl = user.config.datacrazyWebhookUrl || env.DATACRAZY_WEBHOOK_URL || '';
  user.leads = user.leads || [];
  user.history = user.history || [];
  user.deletedUsernames = user.deletedUsernames || [];
  return { usersDb, user };
}

const PORT = 3099;

// Verificação Assíncrona na Biblioteca da Meta em Background (Não trava a pesquisa do usuário!)
async function verifyMetaAdsInBackground(userId, validProfiles, nicheObj, cleanLocation, autoSendDataCrazy) {
  if (!validProfiles || validProfiles.length === 0) return;
  const env = loadEnv();
  const token = env.APIFY_API_TOKEN;
  if (!token) return;

  try {
    const startUrls = validProfiles.map((p) => ({
      url: `https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=BR&q=${encodeURIComponent(p.username)}`
    }));

    const adsResp = await fetch(`https://api.apify.com/v2/acts/apify~facebook-ads-scraper/run-sync-get-dataset-items?token=${encodeURIComponent(token)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        startUrls,
        onlyTotal: false,
        resultsLimit: 4
      })
    });

    if (!adsResp.ok) return;
    const adsResults = await adsResp.json();
    fs.writeFileSync(path.join(TMP_DIR, 'last_meta_ads_check.json'), JSON.stringify(adsResults, null, 2), 'utf-8');

    const { usersDb, user } = getUserContext({ headers: {} }, userId);
    let changed = false;

    if (Array.isArray(adsResults)) {
      for (const item of adsResults) {
        const qMatch = String(item.inputUrl || '').match(/[?&]q=([^&]+)/);
        if (!qMatch) continue;
        const uName = decodeURIComponent(qMatch[1]).toLowerCase();
        const prof = validProfiles.find((vp) => vp.username.toLowerCase() === uName);
        if (!prof) continue;

        const parsedAd = parseMetaAdsResultForProfile(item, prof);
        const leadIdx = user.leads.findIndex((l) => l.instagram.username.toLowerCase() === uName);
        if (leadIdx >= 0) {
          const lead = user.leads[leadIdx];
          lead.meta_ads.in_ad_library = parsedAd.count > 0;
          lead.meta_ads.active_ads_count = parsedAd.count;
          lead.meta_ads.ad_library_status_label = parsedAd.count > 0 ? `Está na Biblioteca (${parsedAd.count} anúncios)` : 'Não está na Biblioteca';
          if (!lead.contact.whatsapp_number && parsedAd.adPhone) {
            lead.contact.whatsapp_number = parsedAd.adPhone;
          }
          lead.qualification = qualifyLead({
            inAdLibrary: lead.meta_ads.in_ad_library,
            activeAdsCount: lead.meta_ads.active_ads_count,
            whatsappNumber: lead.contact.whatsapp_number,
            followersCount: lead.instagram.followers_count,
            biography: lead.instagram.biography
          });
          lead.message_strategy = generateFirstMessageStrategy({
            fullName: lead.instagram.full_name,
            username: lead.instagram.username,
            nicheId: lead.niche_id,
            nicheName: lead.niche_name,
            location: lead.location,
            biography: lead.instagram.biography,
            inAdLibrary: lead.meta_ads.in_ad_library,
            activeAdsCount: lead.meta_ads.active_ads_count,
            whatsappNumber: lead.contact.whatsapp_number,
            followersCount: lead.instagram.followers_count
          });
          lead.contact.personalized_message = lead.message_strategy.first_message;
          lead.contact.whatsapp_link = lead.contact.whatsapp_number
            ? `https://wa.me/${lead.contact.whatsapp_number}?text=${encodeURIComponent(lead.contact.personalized_message)}`
            : `https://ig.me/m/${lead.instagram.username}`;
          changed = true;
        }
      }
    }

    if (changed) {
      saveUsersDb(usersDb);
    }
  } catch (err) {
    console.error('Aviso na verificação Meta Ads em background:', err.message);
  }
}

// Motor centralizado de execução de prospecção ULTRA-RÁPIDA (Google Instagram Index + Validação de Links Reais)
async function executeProspectingRun({ userId = 'user-salles', nicheId, keyword, location, limit, autoSendDataCrazy, source = 'manual' }) {
  const env = loadEnv();
  const token = env.APIFY_API_TOKEN;
  if (!token) {
    throw new Error('Token da Apify não encontrado no .env');
  }

  const { usersDb, user } = getUserContext({ headers: {} }, userId);
  const config = user.config;
  const nicheObj = config.niches.find((n) => n.id === nicheId) || config.niches[0];
  const rawKeyword = (keyword || nicheObj.keywords[0] || nicheObj.name).trim();
  const cleanLocation = (location || 'Brasil').trim();
  const cityClean = cleanLocation && cleanLocation.toLowerCase() !== 'brasil' ? cleanLocation.split('-')[0].trim() : '';

  const searchQuery = cityClean ? `${rawKeyword} ${cityClean}` : rawKeyword;
  const parsedLimit = Math.min(Math.max(Number(limit) || 6, 1), 15);

  // 1. BUSCA ULTRA-RÁPIDA (~12s) via apify/google-search-scraper filtrando apenas perfis raiz válidos do Instagram!
  const googleQuery = `site:instagram.com ${searchQuery}`;
  let candidateProfiles = [];

  try {
    const gResp = await fetch(`https://api.apify.com/v2/acts/apify~google-search-scraper/run-sync-get-dataset-items?token=${encodeURIComponent(token)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        queries: googleQuery,
        maxPagesPerQuery: 1,
        resultsPerPage: Math.min(parsedLimit * 4, 30),
        countryCode: 'br',
        languageCode: 'pt-BR'
      })
    });

    if (gResp.ok) {
      const gData = await gResp.json();
      candidateProfiles = parseGoogleInstagramResults(gData);
    }
  } catch (gErr) {
    console.error('Aviso na busca rápida Google Instagram:', gErr.message);
  }

  // Fallback para instagram-search-scraper somente se o Google trouxer zero resultados
  if (candidateProfiles.length === 0) {
    const igResp = await fetch(`https://api.apify.com/v2/acts/apify~instagram-search-scraper/run-sync-get-dataset-items?token=${encodeURIComponent(token)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        search: searchQuery,
        searchType: 'user',
        searchLimit: Math.min(parsedLimit * 2, 16)
      })
    });
    if (igResp.ok) {
      const igData = await igResp.json();
      candidateProfiles = Array.isArray(igData) ? igData : [];
    }
  }

  const deletedSet = new Set((user.deletedUsernames || []).map((u) => String(u).toLowerCase()));
  const discardedProfiles = [];
  const healthyProfiles = [];

  for (const p of candidateProfiles) {
    if (!p || !p.username) continue;
    const uLow = String(p.username).toLowerCase();
    // Garantir que o username é 100% válido para link do Instagram
    if (!/^[a-z0-9._]{2,30}$/i.test(uLow)) {
      discardedProfiles.push({ username: p.username, reason: 'Link de perfil inválido' });
      continue;
    }
    if (deletedSet.has(uLow)) {
      discardedProfiles.push({ username: p.username, reason: 'Já excluído pelo usuário anteriormente' });
      continue;
    }
    const health = checkProfileHealth(p, nicheObj, cleanLocation);
    if (!health.isHealthy) {
      discardedProfiles.push({ username: p.username, reason: health.reason });
      continue;
    }
    healthyProfiles.push(p);
    if (healthyProfiles.length >= parsedLimit) break;
  }

  const validProfiles = healthyProfiles;

  fs.writeFileSync(
    path.join(TMP_DIR, 'last_ig_search.json'),
    JSON.stringify({ searchQuery, source, validProfiles, discardedProfiles }, null, 2),
    'utf-8'
  );

  // 2. Resolver Linktree / Bio Links em paralelo (com timeout rápido)
  const resolvedBioPhones = {};
  await Promise.all(
    validProfiles.map(async (p) => {
      const directPhone = p.whatsapp_number || extractPhone(p.biography || '', p.externalUrl || '', p.businessPhoneNumber || '', p.externalUrls || []);
      if (directPhone) {
        resolvedBioPhones[p.username.toLowerCase()] = directPhone;
      } else if (p.externalUrl) {
        const fromBioLink = await resolveBioLinkWhatsApp(p.externalUrl);
        if (fromBioLink) {
          resolvedBioPhones[p.username.toLowerCase()] = fromBioLink;
        }
      }
    })
  );

  const newLeads = [];

  for (const p of validProfiles) {
    const uLower = p.username.toLowerCase();
    const resolvedWa = resolvedBioPhones[uLower] || '';
    const leadObj = buildProspectLead({
      username: p.username,
      full_name: p.fullName || p.username,
      biography: p.biography || '',
      external_url: p.externalUrl || '',
      followers_count: p.followersCount || 500,
      whatsapp_number: resolvedWa,
      in_ad_library: false,
      active_ads_count: 0,
      location: cleanLocation
    }, nicheObj, cleanLocation);

    if (autoSendDataCrazy && !leadObj.meta_ads.in_ad_library) {
      try {
        await sendLeadToDataCrazy(leadObj, config.datacrazyWebhookUrl);
        leadObj.contact.datacrazy_synced = true;
        leadObj.contact.datacrazy_synced_at = new Date().toISOString();
      } catch {
        // Segue mesmo se um falhar
      }
    }

    const existingIdx = user.leads.findIndex((l) => l.instagram.username.toLowerCase() === uLower);
    if (existingIdx >= 0) {
      user.leads[existingIdx] = leadObj;
    } else {
      user.leads.unshift(leadObj);
    }
    newLeads.push(leadObj);
  }

  user.history = user.history || [];
  user.history.unshift({
    id: `run-${Date.now()}`,
    source,
    nicheName: nicheObj.name,
    searchQuery,
    location: cleanLocation,
    foundCount: newLeads.length,
    discardedCount: discardedProfiles.length,
    highPriorityCount: newLeads.filter((l) => !l.meta_ads.in_ad_library).length,
    inLibraryCount: newLeads.filter((l) => l.meta_ads.in_ad_library).length,
    timestamp: new Date().toISOString()
  });

  saveUsersDb(usersDb);

  // 3. Disparar verificação na Biblioteca da Meta em BACKGROUND para não travar a resposta!
  verifyMetaAdsInBackground(user.id, validProfiles, nicheObj, cleanLocation, autoSendDataCrazy);

  return {
    newLeadsCount: newLeads.length,
    discardedCount: discardedProfiles.length,
    leads: user.leads,
    history: user.history
  };
}

export async function requestHandler(req, res) {
  if (req.method === 'OPTIONS') {
    return sendJson(res, 200, { ok: true });
  }

  const urlObj = new URL(req.url, `http://localhost:${PORT}`);
  const pathname = urlObj.pathname;

  if (pathname === '/' && req.method === 'GET') {
    if (fs.existsSync(UI_PATH)) {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      return res.end(fs.readFileSync(UI_PATH, 'utf-8'));
    }
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
    return res.end('Dashboard sendo inicializado...');
  }

  // Sincronizar estado mais recente do Supabase PostgreSQL se estiver conectado
  if (pathname.startsWith('/api/')) {
    await pullUsersFromSupabaseIfConfigured();
  }

  // Autenticação: Login
  if (pathname === '/api/auth/login' && req.method === 'POST') {
    try {
      const body = await parseJsonBody(req);
      const email = String(body.email || '').trim().toLowerCase();
      const password = String(body.password || '').trim();
      const usersDb = loadUsersDb();
      const user = usersDb.users.find((u) => String(u.email || '').toLowerCase() === email && String(u.password || '') === password);
      if (!user) {
        return sendJson(res, 401, { ok: false, error: 'E-mail ou senha inválidos.' });
      }
      return sendJson(res, 200, {
        ok: true,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          onboardingCompleted: Boolean(user.onboardingCompleted),
          preferences: user.preferences || {}
        },
        leads: user.leads || [],
        history: user.history || [],
        config: user.config || loadConfig()
      });
    } catch (err) {
      return sendJson(res, 400, { ok: false, error: err.message });
    }
  }

  // Autenticação: Cadastro de Novo Usuário (inicia com Pré-Formulário de Onboarding ativo!)
  if (pathname === '/api/auth/register' && req.method === 'POST') {
    try {
      const body = await parseJsonBody(req);
      const name = String(body.name || 'Usuário').trim();
      const email = String(body.email || '').trim().toLowerCase();
      const password = String(body.password || '').trim();
      if (!email || !password) {
        return sendJson(res, 400, { ok: false, error: 'Preencha nome, e-mail e senha.' });
      }
      const usersDb = loadUsersDb();
      if (usersDb.users.some((u) => String(u.email || '').toLowerCase() === email)) {
        return sendJson(res, 400, { ok: false, error: 'Este e-mail já está cadastrado. Faça login!' });
      }
      const env = loadEnv();
      const newUser = {
        id: `user-${Date.now()}`,
        name,
        email,
        password,
        onboardingCompleted: false,
        preferences: {},
        leads: [],
        history: [],
        deletedUsernames: [],
        config: {
          niches: JSON.parse(JSON.stringify(DEFAULT_NICHES)),
          selectedNicheId: 'automotivo-estetica',
          autoSendDataCrazy: false,
          datacrazyWebhookUrl: env.DATACRAZY_WEBHOOK_URL || '',
          apifyConnected: Boolean(env.APIFY_API_TOKEN),
          trigger: {
            enabled: false,
            intervalHours: 24,
            nicheId: 'automotivo-estetica',
            keyword: 'estetica automotiva',
            location: 'Petrolina - PE',
            limit: 6,
            autoSendDataCrazy: true,
            lastRunAt: null,
            nextRunAt: null
          }
        }
      };
      usersDb.users.push(newUser);
      saveUsersDb(usersDb);
      return sendJson(res, 200, {
        ok: true,
        user: {
          id: newUser.id,
          name: newUser.name,
          email: newUser.email,
          onboardingCompleted: false,
          preferences: {}
        },
        leads: [],
        history: [],
        config: newUser.config
      });
    } catch (err) {
      return sendJson(res, 400, { ok: false, error: err.message });
    }
  }

  // Pré-Formulário Inicial (Onboarding): Salva o nicho de interesse do usuário e já roda a Pré-Pesquisa Ultra-Rápida!
  if (pathname === '/api/auth/onboarding' && req.method === 'POST') {
    try {
      const body = await parseJsonBody(req);
      const { usersDb, user } = getUserContext(req, body.userId);
      const nicheName = String(body.interestedNiche || body.nicheName || body.category || 'Meu Nicho').trim();
      const category = String(body.category || nicheName).trim();
      const keyword = String(body.targetKeywords || body.keyword || nicheName).trim();
      const location = String(body.targetCity || body.location || 'Petrolina - PE').trim();
      const limit = Number(body.limit) || 6;
      const runPreSearch = body.runPreSearch !== false;
      const autoSendDataCrazy = Boolean(body.autoSendDataCrazy);

      const nicheId = String(nicheName)
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-');

      const newNiche = {
        id: nicheId,
        name: nicheName,
        category,
        keywords: [keyword, nicheName.toLowerCase()],
        defaultMessage: `Opa, tudo bom? Peguei o contato de vocês lá no Instagram. Quem aí cuida da parte comercial/marketing pra eu falar rapidinho?`
      };

      const existingIdx = user.config.niches.findIndex((n) => n.id === nicheId);
      if (existingIdx >= 0) {
        user.config.niches[existingIdx] = newNiche;
      } else {
        user.config.niches.unshift(newNiche);
      }
      user.config.selectedNicheId = nicheId;
      user.onboardingCompleted = true;
      user.preferences = {
        interestedNiche: nicheName,
        targetKeywords: keyword,
        targetCity: location,
        category,
        nicheName,
        keyword,
        location
      };
      saveUsersDb(usersDb);

      let result = { newLeadsCount: 0, discardedCount: 0, leads: user.leads, history: user.history };
      if (runPreSearch) {
        result = await executeProspectingRun({
          userId: user.id,
          nicheId,
          keyword,
          location,
          limit,
          autoSendDataCrazy,
          source: 'onboarding_pre_pesquisa'
        });
      }

      const refreshed = getUserContext(req, user.id).user;
      return sendJson(res, 200, {
        ok: true,
        user: {
          id: refreshed.id,
          name: refreshed.name,
          email: refreshed.email,
          onboardingCompleted: true,
          preferences: refreshed.preferences
        },
        config: refreshed.config,
        ...result
      });
    } catch (err) {
      return sendJson(res, 500, { ok: false, error: err.message });
    }
  }

  if (pathname === '/api/state' && req.method === 'GET') {
    const { user } = getUserContext(req);
    return sendJson(res, 200, {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        onboardingCompleted: Boolean(user.onboardingCompleted),
        preferences: user.preferences || {}
      },
      leads: user.leads,
      history: user.history || [],
      config: user.config
    });
  }

  if (pathname === '/api/niches' && req.method === 'POST') {
    try {
      const body = await parseJsonBody(req);
      const { usersDb, user } = getUserContext(req);
      const config = user.config;
      const id = body.id || String(body.name || 'nicho').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-');
      const newNiche = {
        id,
        name: body.name,
        category: body.category || 'Personalizado',
        keywords: Array.isArray(body.keywords) ? body.keywords : String(body.keywords || '').split(',').map((s) => s.trim()).filter(Boolean),
        defaultMessage: body.defaultMessage || 'Opa, tudo bom? Peguei o contato de vocês lá no Instagram. Quem aí cuida da parte comercial pra eu falar rapidinho?'
      };
      const existingIdx = config.niches.findIndex((n) => n.id === id);
      if (existingIdx >= 0) config.niches[existingIdx] = newNiche;
      else config.niches.unshift(newNiche);
      config.selectedNicheId = id;
      saveUsersDb(usersDb);
      return sendJson(res, 200, { ok: true, config });
    } catch (err) {
      return sendJson(res, 400, { ok: false, error: err.message });
    }
  }

  // Pesquisa em Tempo Real Ultra-Rápida (por Usuário Logado)
  if (pathname === '/api/prospect' && req.method === 'POST') {
    try {
      const body = await parseJsonBody(req);
      const { user } = getUserContext(req);
      const result = await executeProspectingRun({
        userId: user.id,
        nicheId: body.nicheId,
        keyword: body.keyword,
        location: body.location,
        limit: body.limit,
        autoSendDataCrazy: body.autoSendDataCrazy,
        source: 'manual'
      });
      return sendJson(res, 200, {
        ok: true,
        ...result
      });
    } catch (err) {
      return sendJson(res, 500, { ok: false, error: err.message });
    }
  }

  // Configurar Gatilho de Automação (Fase 5 — G: Gatilho / Piloto Automático)
  if (pathname === '/api/trigger/config' && req.method === 'POST') {
    try {
      const body = await parseJsonBody(req);
      const { usersDb, user } = getUserContext(req);
      const config = user.config;
      const enabled = Boolean(body.enabled);
      const intervalHours = Math.max(1, Number(body.intervalHours) || 24);
      const nextRunAt = enabled ? new Date(Date.now() + intervalHours * 3600 * 1000).toISOString() : null;

      config.trigger = {
        ...config.trigger,
        enabled,
        intervalHours,
        nicheId: body.nicheId || config.trigger.nicheId,
        keyword: body.keyword || config.trigger.keyword,
        location: body.location || config.trigger.location,
        limit: Number(body.limit) || config.trigger.limit || 6,
        autoSendDataCrazy: body.autoSendDataCrazy !== undefined ? Boolean(body.autoSendDataCrazy) : true,
        nextRunAt
      };
      saveUsersDb(usersDb);
      return sendJson(res, 200, { ok: true, config });
    } catch (err) {
      return sendJson(res, 400, { ok: false, error: err.message });
    }
  }

  // Enviar Lead individual ou em lote para o CRM DataCrazy
  if (pathname === '/api/datacrazy/send' && req.method === 'POST') {
    try {
      const body = await parseJsonBody(req);
      const { usersDb, user } = getUserContext(req);
      const config = user.config;
      const ids = Array.isArray(body.leadIds) ? body.leadIds : [body.leadId];
      const synced = [];

      for (const id of ids) {
        const idx = user.leads.findIndex((l) => l.id === id);
        if (idx < 0) continue;
        await sendLeadToDataCrazy(user.leads[idx], config.datacrazyWebhookUrl);
        user.leads[idx].contact.datacrazy_synced = true;
        user.leads[idx].contact.datacrazy_synced_at = new Date().toISOString();
        synced.push(user.leads[idx]);
      }

      saveUsersDb(usersDb);
      return sendJson(res, 200, { ok: true, syncedCount: synced.length, leads: user.leads });
    } catch (err) {
      return sendJson(res, 500, { ok: false, error: err.message });
    }
  }

  // Atualizar status ou telefone do lead
  if (pathname.startsWith('/api/leads/') && req.method === 'PATCH') {
    try {
      const id = decodeURIComponent(pathname.replace('/api/leads/', ''));
      const body = await parseJsonBody(req);
      const { usersDb, user } = getUserContext(req);
      const idx = user.leads.findIndex((l) => l.id === id);
      if (idx < 0) return sendJson(res, 404, { ok: false, error: 'Lead não encontrado' });

      const lead = user.leads[idx];
      if (body.pipeline_status) lead.contact.pipeline_status = body.pipeline_status;
      if (body.whatsapp_number !== undefined) {
        const clean = String(body.whatsapp_number).replace(/\D/g, '');
        lead.contact.whatsapp_number = clean.startsWith('55') || !clean ? clean : `55${clean}`;
        lead.qualification = qualifyLead({
          inAdLibrary: lead.meta_ads.in_ad_library,
          activeAdsCount: lead.meta_ads.active_ads_count,
          whatsappNumber: lead.contact.whatsapp_number,
          followersCount: lead.instagram.followers_count,
          biography: lead.instagram.biography
        });
        lead.message_strategy = generateFirstMessageStrategy({
          fullName: lead.instagram.full_name,
          username: lead.instagram.username,
          nicheId: lead.niche_id,
          nicheName: lead.niche_name,
          location: lead.location,
          biography: lead.instagram.biography,
          inAdLibrary: lead.meta_ads.in_ad_library,
          activeAdsCount: lead.meta_ads.active_ads_count,
          whatsappNumber: lead.contact.whatsapp_number,
          followersCount: lead.instagram.followers_count
        });
        lead.contact.personalized_message = lead.message_strategy.first_message;
        lead.contact.whatsapp_link = lead.contact.whatsapp_number
          ? `https://wa.me/${lead.contact.whatsapp_number}?text=${encodeURIComponent(lead.contact.personalized_message)}`
          : `https://ig.me/m/${lead.instagram.username}`;
      }
      if (body.personalized_message !== undefined) {
        lead.contact.personalized_message = String(body.personalized_message);
        lead.contact.whatsapp_link = lead.contact.whatsapp_number
          ? `https://wa.me/${lead.contact.whatsapp_number}?text=${encodeURIComponent(lead.contact.personalized_message)}`
          : `https://ig.me/m/${lead.instagram.username}`;
      }
      if (body.in_ad_library !== undefined) {
        lead.meta_ads.in_ad_library = Boolean(body.in_ad_library);
        lead.meta_ads.ad_library_status_label = lead.meta_ads.in_ad_library ? 'Está na Biblioteca' : 'Não está na Biblioteca';
        lead.qualification = qualifyLead({
          inAdLibrary: lead.meta_ads.in_ad_library,
          activeAdsCount: lead.meta_ads.active_ads_count,
          whatsappNumber: lead.contact.whatsapp_number,
          followersCount: lead.instagram.followers_count,
          biography: lead.instagram.biography
        });
      }

      saveUsersDb(usersDb);
      return sendJson(res, 200, { ok: true, lead, leads: user.leads });
    } catch (err) {
      return sendJson(res, 500, { ok: false, error: err.message });
    }
  }

  // Excluir lead inexistente/descartado e bloquear para não voltar em buscas futuras
  if (pathname.startsWith('/api/leads/') && req.method === 'DELETE') {
    try {
      const id = decodeURIComponent(pathname.replace('/api/leads/', ''));
      const { usersDb, user } = getUserContext(req);
      const idx = user.leads.findIndex((l) => l.id === id);
      if (idx < 0) return sendJson(res, 404, { ok: false, error: 'Lead não encontrado' });

      const removed = user.leads.splice(idx, 1)[0];
      const uName = String(removed?.instagram?.username || '').toLowerCase();
      if (uName) {
        user.deletedUsernames = Array.from(new Set([...(user.deletedUsernames || []), uName]));
      }

      saveUsersDb(usersDb);
      return sendJson(res, 200, { ok: true, deletedId: id, deletedUsername: uName, leads: user.leads });
    } catch (err) {
      return sendJson(res, 500, { ok: false, error: err.message });
    }
  }

  // Endpoint para Vercel Cron / Gatilho Externo
  if (pathname === '/api/cron' && req.method === 'GET') {
    try {
      const config = loadConfig();
      const trig = config.trigger || {};
      const result = await executeProspectingRun({
        nicheId: trig.nicheId || 'automotivo-revenda',
        keyword: trig.keyword || 'seminovos',
        location: trig.location || 'Petrolina - PE',
        limit: trig.limit || 6,
        autoSendDataCrazy: trig.autoSendDataCrazy !== false,
        source: 'vercel_cron'
      });
      return sendJson(res, 200, { ok: true, ...result });
    } catch (err) {
      return sendJson(res, 500, { ok: false, error: err.message });
    }
  }

  return sendJson(res, 404, { error: 'Rota não encontrada' });
}

if (!IS_VERCEL) {
  const server = http.createServer(requestHandler);

  // Agendador Automático em Background (Fase 5 — G: Gatilho)
  let isTriggerRunning = false;
  setInterval(async () => {
    if (isTriggerRunning) return;
    try {
      const config = loadConfig();
      const trig = config.trigger;
      if (!trig || !trig.enabled || !trig.nextRunAt) return;
      const now = Date.now();
      const nextTime = new Date(trig.nextRunAt).getTime();
      if (now >= nextTime) {
        isTriggerRunning = true;
        console.log(`⚡ [GATILHO AUTOMÁTICO] Executando prospecção agendada: ${trig.keyword} em ${trig.location}`);
        await executeProspectingRun({
          nicheId: trig.nicheId,
          keyword: trig.keyword,
          location: trig.location,
          limit: trig.limit || 6,
          autoSendDataCrazy: trig.autoSendDataCrazy !== false,
          source: 'gatilho_automatico'
        });
        const updatedCfg = loadConfig();
        const hours = Math.max(1, Number(updatedCfg.trigger?.intervalHours) || 24);
        updatedCfg.trigger.lastRunAt = new Date().toISOString();
        updatedCfg.trigger.nextRunAt = new Date(Date.now() + hours * 3600 * 1000).toISOString();
        saveConfig(updatedCfg);
      }
    } catch (err) {
      console.error('Erro no Gatilho Automático:', err.message);
    } finally {
      isTriggerRunning = false;
    }
  }, 60 * 1000);

  server.listen(PORT, () => {
    console.log(`🚀 [V.L.A.E.G. Server] Rodando em http://localhost:${PORT}`);
  });
}
