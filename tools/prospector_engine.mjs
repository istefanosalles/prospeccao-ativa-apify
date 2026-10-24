import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.join(__dirname, '..');
const ENV_PATH = path.join(ROOT_DIR, '.env');

function loadEnv() {
  const envVars = {
    APIFY_API_TOKEN: process.env.APIFY_API_TOKEN || '',
    DATACRAZY_WEBHOOK_URL: process.env.DATACRAZY_WEBHOOK_URL || ''
  };
  if (fs.existsSync(ENV_PATH)) {
    const lines = fs.readFileSync(ENV_PATH, 'utf-8').split(/\r?\n/);
    for (const line of lines) {
      if (!line || line.startsWith('#')) continue;
      const idx = line.indexOf('=');
      if (idx > 0) {
        envVars[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
      }
    }
  }
  return envVars;
}

// Extrair serviço principal citado na bio para deixar a 1ª mensagem ultra-específica
export function detectMainService(biography = '', nicheId = 'automotivo-estetica', nicheName = '') {
  const bioLower = biography.toLowerCase();
  if (bioLower.includes('ppf') && bioLower.includes('vitrifica')) return 'PPF e Vitrificação';
  if (bioLower.includes('ppf')) return 'proteção de pintura (PPF)';
  if (bioLower.includes('vitrifica')) return 'vitrificação e estética automotiva';
  if (bioLower.includes('polimento')) return 'polimento técnico e estética';
  if (bioLower.includes('seminovo') || bioLower.includes('multimarcas') || bioLower.includes('financia')) return 'venda e financiamento de seminovos';
  if (bioLower.includes('cambio') || bioLower.includes('câmbio')) return 'manutenção de câmbio automático e revisão';
  if (bioLower.includes('oficina') || bioLower.includes('mecânica') || bioLower.includes('mecanica')) return 'revisão e mecânica especializada';
  if (bioLower.includes('insulfilm') || bioLower.includes('pelicula') || bioLower.includes('película')) return 'películas premium e acessórios';
  if (bioLower.includes('curso') || bioLower.includes('formação') || bioLower.includes('treinamento')) return 'cursos e treinamentos automotivos';

  if (nicheId === 'automotivo-revenda') return 'venda de veículos seminovos';
  if (nicheId === 'automotivo-oficina') return 'serviços de centro automotivo';
  if (nicheId === 'automotivo-som-pelicula') return 'películas, som e estética automotiva';
  return nicheName ? nicheName.toLowerCase() : 'estética automotiva';
}

// Gerador determinístico da 1ª Mensagem baseada no Caso Real do Lead (POP 03)
export function generateFirstMessageStrategy({
  fullName,
  username,
  nicheId,
  nicheName,
  location,
  biography,
  inAdLibrary,
  activeAdsCount,
  whatsappNumber,
  followersCount
}) {
  const bioLower = (biography || '').toLowerCase();
  const nicheLower = `${nicheId || ''} ${nicheName || ''}`.toLowerCase();
  const isCarDealer = nicheLower.includes('revenda') || nicheLower.includes('seminovo') || bioLower.includes('seminovo') || bioLower.includes('multimarcas') || bioLower.includes('veículo') || bioLower.includes('veiculo');
  const isWorkshop = nicheLower.includes('oficina') || bioLower.includes('oficina') || bioLower.includes('mecânica') || bioLower.includes('mecanica');
  const isAuto = nicheLower.includes('automotivo') || nicheLower.includes('estetica') || isCarDealer || isWorkshop;
  const isClinic = nicheLower.includes('odonto') || nicheLower.includes('clinica') || nicheLower.includes('clínica') || nicheLower.includes('saude') || nicheLower.includes('médic') || bioLower.includes('odonto') || bioLower.includes('dentista') || bioLower.includes('clínica') || bioLower.includes('clinica');
  const isRealEstate = nicheLower.includes('imob') || nicheLower.includes('imóv') || bioLower.includes('imobiliária') || bioLower.includes('imoveis') || bioLower.includes('construtora');
  const isLaw = nicheLower.includes('advoc') || nicheLower.includes('juríd') || bioLower.includes('advogad') || bioLower.includes('escritório');
  const isFood = nicheLower.includes('restaurante') || nicheLower.includes('delivery') || nicheLower.includes('gastronomia') || bioLower.includes('delivery') || bioLower.includes('cardápio');

  let placeWord = 'da empresa';
  let sectorWord = nicheName ? `do setor de ${nicheName.toLowerCase()}` : 'da sua área';
  if (isCarDealer) {
    placeWord = 'da loja';
    sectorWord = 'do ramo automotivo';
  } else if (isWorkshop) {
    placeWord = 'da oficina';
    sectorWord = 'do ramo automotivo';
  } else if (isAuto) {
    placeWord = 'da estética';
    sectorWord = 'do ramo automotivo';
  } else if (isClinic) {
    placeWord = 'da clínica';
    sectorWord = 'da área de clínicas e saúde';
  } else if (isRealEstate) {
    placeWord = 'da imobiliária';
    sectorWord = 'do mercado imobiliário';
  } else if (isLaw) {
    placeWord = 'do escritório';
    sectorWord = 'da área jurídica';
  } else if (isFood) {
    placeWord = 'do restaurante';
    sectorWord = 'do ramo de gastronomia e delivery';
  }

  const hasWa = Boolean(whatsappNumber);

  // CASO 1: NÃO anuncia na Biblioteca da Meta + Tem WhatsApp Direto
  if (!inAdLibrary && hasWa) {
    const firstMsg = isCarDealer
      ? `Opa, tudo bom? Peguei o contato de vocês lá no Instagram. Quem aí da loja cuida dessa parte comercial/marketing pra eu falar rapidinho?`
      : isClinic
      ? `Opa, tudo bom? Peguei o WhatsApp de vocês lá no Instagram. Quem aí da clínica cuida da parte comercial/captação de pacientes pra eu falar rapidinho?`
      : `Opa, tudo bom? Peguei o WhatsApp de vocês lá no Instagram. É você mesmo que é o responsável aí ${placeWord} ou é da equipe de atendimento?`;

    const secondMsg = `Perguntei porque trabalho ajudando empresas ${sectorWord} a puxar cliente todo dia pelo Instagram, e vi que vocês não estão com nenhum anúncio ativo hoje. Posso te mandar um áudio de 30 segundos te explicando?`;

    return {
      case_code: 'CASO_1_NAO_ANUNCIA_COM_WHATSAPP',
      case_title: 'Caso 1 • Não Anuncia + Tem WhatsApp',
      strategy_reason: 'Sem cara de robô: faz a pessoa responder primeiro se é o dono/responsável antes de falar de tráfego.',
      recommended_channel: 'WhatsApp Direto',
      first_message: firstMsg,
      second_message_hint: secondMsg
    };
  }

  // CASO 2: NÃO anuncia na Biblioteca da Meta + SEM WhatsApp na Bio
  if (!inAdLibrary && !hasWa) {
    const firstMsg = `Opa, tudo bom? Tentei chamar vocês no WhatsApp pelo link aqui da bio mas não foi. Qual o WhatsApp aí ${placeWord} pra eu falar rapidinho?`;
    const secondMsg = `Opa, me passaram seu contato lá no Instagram! Te chamei porque vi o perfil de vocês e reparei que vocês não estão com nenhum anúncio rodando hoje pra puxar cliente pro WhatsApp. Posso te mandar um áudio de 30s?`;

    return {
      case_code: 'CASO_2_NAO_ANUNCIA_SEM_WHATSAPP',
      case_title: 'Caso 2 • Não Anuncia + Sem WhatsApp na Bio',
      strategy_reason: 'Pede o número direto no Direct como qualquer pessoa normal faria.',
      recommended_channel: 'Direct do Instagram',
      first_message: firstMsg,
      second_message_hint: secondMsg
    };
  }

  // CASO 3: ESTÁ na Biblioteca da Meta (1 a 4 anúncios)
  if (inAdLibrary && Number(activeAdsCount) <= 4) {
    const firstMsg = `Opa, tudo bom? Vi o anúncio de vocês rodando lá no Instagram. É você mesmo que cuida dessa parte comercial aí ${placeWord} ou tem outra pessoa responsável?`;
    const secondMsg = `Te perguntei porque trabalho com empresas ${sectorWord} e vi a campanha de vocês. O pessoal que tá chegando pelo anúncio tá vindo qualificado pronto pra fechar ou tá caindo muito curioso perguntando preço?`;

    return {
      case_code: 'CASO_3_NA_BIBLIOTECA_POUCOS_ANUNCIOS',
      case_title: `Caso 3 • Já Anuncia (${activeAdsCount} anúncio ativo)`,
      strategy_reason: 'Entra comentando que viu o anúncio dele rodando e toca na dor de curiosos perguntando preço.',
      recommended_channel: hasWa ? 'WhatsApp Direto' : 'Direct do Instagram',
      first_message: firstMsg,
      second_message_hint: secondMsg
    };
  }

  // CASO 4: ESTÁ na Biblioteca da Meta (5+ anúncios)
  const firstMsg = `Opa, tudo bom? Vi os anúncios de vocês rodando lá no Instagram. Quem aí ${placeWord} cuida hoje da parte comercial e do atendimento no WhatsApp?`;
  const secondMsg = `Como vocês já rodam bastante anúncio, queria entender como estão fazendo hoje pra atender na hora e fazer follow-up em quem pede orçamento e some. Posso te mostrar em 30s como automatizamos isso com IA?`;

  return {
    case_code: 'CASO_4_NA_BIBLIOTECA_ESCALA_IA',
    case_title: `Caso 4 • Já Anuncia Forte (${activeAdsCount} anúncios)`,
    strategy_reason: 'Foco em Atendimento com IA e Follow-up para quem já investe em tráfego.',
    recommended_channel: hasWa ? 'WhatsApp Direto' : 'Direct do Instagram',
    first_message: firstMsg,
    second_message_hint: secondMsg
  };
}

// Extrai WhatsApp celular real (ignora telefones fixos como 3201-3000) e detecta Linktree/agregadores
export function extractPhone(biography = '', externalUrl = '', businessPhone = '', externalUrls = []) {
  const urlsText = Array.isArray(externalUrls)
    ? externalUrls.map((u) => `${u.url || ''} ${u.lynx_url || ''}`).join(' ')
    : '';
  const combined = `${businessPhone || ''} ${externalUrl || ''} ${urlsText} ${biography || ''}`;

  // 1. Links diretos wa.me ou api.whatsapp.com
  const waMatch = combined.match(/wa\.me\/(\d{10,13})/i) || combined.match(/phone=(\d{10,13})/i) || combined.match(/phoneNumber=(\d{10,13})/i);
  if (waMatch) {
    const raw = waMatch[1].replace(/\D/g, '');
    return raw.startsWith('55') ? raw : `55${raw}`;
  }

  // 2. Números de CELULAR brasileiros (com dígito 9 após o DDD, mesmo com espaço como "(87) 9 8133-7246")
  const mobileRegex = /(?:\+?55\s?)?(?:\(?(\d{2})\)?\s?)(9\s?\d{4,5})[-\s.]?(\d{4})/g;
  const mobileMatch = mobileRegex.exec(combined);
  if (mobileMatch) {
    const ddd = mobileMatch[1];
    let firstPart = mobileMatch[2].replace(/\D/g, '');
    if (firstPart.length === 6 && firstPart.startsWith('99')) {
      firstPart = firstPart.slice(1);
    }
    const secondPart = mobileMatch[3].replace(/\D/g, '');
    if (firstPart.length === 5 && secondPart.length === 4) {
      return `55${ddd}${firstPart}${secondPart}`;
    }
  }

  return '';
}

// Converte resultados do apify/google-search-scraper (site:instagram.com) em perfis 100% válidos, descartando links de posts/reels quebrados
export function parseGoogleInstagramResults(googleDataset = []) {
  const blockedSegments = new Set([
    'p', 'reel', 'reels', 'tv', 'stories', 'explore', 'tags',
    'locations', 'accounts', 'directory', 'about', 'legal', 'developer'
  ]);
  const seenUsernames = new Set();
  const profiles = [];

  const organicList = [];
  for (const page of Array.isArray(googleDataset) ? googleDataset : []) {
    if (Array.isArray(page?.organicResults)) {
      organicList.push(...page.organicResults);
    }
  }

  for (const item of organicList) {
    const rawUrl = String(item?.url || '').trim();
    const urlMatch = rawUrl.match(/^https?:\/\/(?:www\.)?instagram\.com\/([a-zA-Z0-9._]{2,30})\/?(?:\?.*)?$/i);
    if (!urlMatch) continue;

    const username = urlMatch[1].trim();
    const uLower = username.toLowerCase();
    if (blockedSegments.has(uLower) || seenUsernames.has(uLower)) continue;
    seenUsernames.add(uLower);

    // Extrair Nome da Empresa do título do Google: ex "Ortho Vip Odontologia (@orthovippetrolina) · Petrolina, PE"
    let fullName = String(item?.title || username)
      .replace(/\(@[^)]+\)/g, '')
      .replace(/•\s*Fotos e vídeos do Instagram/gi, '')
      .replace(/-\s*Instagram/gi, '')
      .split('·')[0]
      .split('•')[0]
      .trim();
    if (!fullName) fullName = username;

    // Extrair quantidade de seguidores de displayedUrl ou description (ex: "Mais de 3,9 mil seguidores")
    const followersText = `${item?.displayedUrl || ''} ${item?.description || ''}`;
    let followersCount = 500;
    const milMatch = followersText.match(/([\d.,]+)\s*mil\s*seguidores/i);
    const miMatch = followersText.match(/([\d.,]+)\s*mi(?:lh[õo]es)?\s*de?\s*seguidores/i);
    const exactMatch = followersText.match(/([\d.]+)\s*seguidores/i);

    if (miMatch) {
      followersCount = Math.round(parseFloat(miMatch[1].replace(',', '.')) * 1000000);
    } else if (milMatch) {
      followersCount = Math.round(parseFloat(milMatch[1].replace(',', '.')) * 1000);
    } else if (exactMatch) {
      followersCount = parseInt(exactMatch[1].replace(/\./g, ''), 10) || 500;
    }

    const biography = String(item?.description || '').trim();
    const directWa = extractPhone(biography, '');

    profiles.push({
      username,
      fullName,
      biography,
      externalUrl: directWa ? `https://wa.me/${directWa}` : '',
      followersCount,
      whatsapp_number: directWa,
      isGoogleVerified: true
    });
  }

  return profiles;
}

// Verifica se o perfil está abandonado, vazio, fora do nicho ou de outra cidade
export function checkProfileHealth(rawItem, nicheObj = null, locationStr = '') {
  const username = String(rawItem.username || '').toLowerCase();
  const fullName = String(rawItem.fullName || rawItem.full_name || '').toLowerCase();
  const bio = String(rawItem.biography || rawItem.bio || '').toLowerCase();
  const extUrl = String(rawItem.externalUrl || rawItem.external_url || '').toLowerCase();
  const phoneStr = String(rawItem.whatsapp_number || rawItem.businessPhoneNumber || '').toLowerCase();
  const combinedText = `${username} ${fullName} ${bio} ${extUrl} ${phoneStr}`;
  const followers = Number(rawItem.followersCount ?? rawItem.followers_count ?? 0);

  // 1. Filtrar perfis vazios/fantasmas (< 150 seguidores) ou franquias gigantes nacionais (> 250.000)
  if (followers < 150) {
    return {
      isHealthy: false,
      reason: `Perfil muito pequeno ou sem dados (${followers} seguidores)`
    };
  }
  if (followers > 250000) {
    return {
      isHealthy: false,
      reason: `Perfil nacional/franquia gigante (${followers.toLocaleString('pt-BR')} seguidores)`
    };
  }

  // 1.1 Filtrar perfis de vendedores pessoa física (não é o perfil da loja)
  const sellerKeywords = ['sales executive', 'executivo de vendas', 'consultor de vendas', 'vendedor autorizado', 'consultora de vendas'];
  for (const sk of sellerKeywords) {
    if (combinedText.includes(sk)) {
      return {
        isHealthy: false,
        reason: `Perfil de vendedor individual ("${sk}"), não da empresa`
      };
    }
  }

  // 2. Filtrar perfis abandonados (último post antes de 2025)
  const posts = Array.isArray(rawItem.latestPosts) ? rawItem.latestPosts : [];
  let lastPostDate = null;
  if (posts.length > 0) {
    const timestamps = posts
      .map((p) => (p.timestamp ? new Date(p.timestamp).getTime() : 0))
      .filter((t) => t > 0);
    if (timestamps.length > 0) {
      lastPostDate = new Date(Math.max(...timestamps));
    }
  }
  if (lastPostDate && lastPostDate.getFullYear() < 2025) {
    return {
      isHealthy: false,
      reason: `Perfil abandonado (último post em ${lastPostDate.getFullYear()})`,
      lastPostYear: lastPostDate.getFullYear()
    };
  }

  // 3. Filtrar intrusos de outros nichos (ex: lojas de roupa "multimarcas" ou portais de notícias em busca automotiva)
  const isAutoNiche = !nicheObj || String(nicheObj.id || '').startsWith('automotivo');
  if (isAutoNiche) {
    const nonAutoKeywords = [
      'moda feminina',
      'moda masculina',
      'personal shopper',
      'consultoria de moda',
      'vestuário',
      'vestuario',
      'look do dia',
      'atacado e varejo',
      'notícias',
      'noticias',
      'jornalismo',
      'portal de',
      'salão de beleza',
      'odontologia'
    ];
    for (const badWord of nonAutoKeywords) {
      if (combinedText.includes(badWord)) {
        return {
          isHealthy: false,
          reason: `Fora do nicho automotivo (detectado: "${badWord}")`
        };
      }
    }
  }

  // 4. Filtrar intrusos de outras cidades/estados quando uma cidade específica foi buscada
  const cleanLoc = String(locationStr || '').split('-')[0].trim().toLowerCase();
  if (cleanLoc && cleanLoc !== 'brasil') {
    const cityAliases = [cleanLoc];
    if (cleanLoc === 'petrolina') {
      cityAliases.push('pnz', 'vale do são francisco', 'vale do sao francisco', 'juazeiro', '5587', '(87)', ' 87 ');
    } else if (cleanLoc === 'recife') {
      cityAliases.push('pe', 'olinda', 'jaboatao', '5581', '(81)');
    } else if (cleanLoc === 'belo horizonte') {
      cityAliases.push('bh', 'savassi', 'contagem', '5531', '(31)');
    } else if (cleanLoc === 'curitiba') {
      cityAliases.push('cwb', 'pr', '5541', '(41)');
    } else if (cleanLoc === 'goiânia' || cleanLoc === 'goiania') {
      cityAliases.push('go', '5562', '(62)');
    } else if (cleanLoc === 'são paulo' || cleanLoc === 'sao paulo') {
      cityAliases.push('sp', 'moema', '5511', '(11)');
    } else if (cleanLoc === 'campinas') {
      cityAliases.push('sp', '5519', '(19)', 'todo brasil');
    }

    const mentionsTargetCity = Boolean(rawItem.isGoogleVerified) || cityAliases.some((alias) => combinedText.includes(alias));

    if (!mentionsTargetCity) {
      return {
        isHealthy: false,
        reason: `Sem vínculo identificado com a cidade buscada (${locationStr})`
      };
    }
  }

  return {
    isHealthy: true,
    lastPostYear: lastPostDate ? lastPostDate.getFullYear() : null
  };
}

// Tenta extrair o número do WhatsApp de dentro de páginas Linktree / Bio Link
export async function resolveBioLinkWhatsApp(externalUrl = '') {
  if (!externalUrl) return '';
  const lower = externalUrl.toLowerCase();
  if (lower.includes('wa.me') || lower.includes('whatsapp.com')) {
    return extractPhone('', externalUrl);
  }
  const isBioAggregator =
    lower.includes('linktr.ee') ||
    lower.includes('linkbio') ||
    lower.includes('bio.site') ||
    lower.includes('beacons.ai') ||
    lower.includes('minhaautoagenda');

  if (!isBioAggregator) return '';

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    const resp = await fetch(externalUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
      signal: controller.signal
    });
    clearTimeout(timer);
    if (!resp.ok) return '';
    const html = await resp.text();
    return extractPhone(html, '');
  } catch {
    return '';
  }
}

// Valida se o retorno da Biblioteca de Anúncios da Meta pertence mesmo ao perfil (evita falso positivo de nomes com _ ou .) e extrai WhatsApp do texto do anúncio se houver
export function parseMetaAdsResultForProfile(adsItem, profile) {
  if (!adsItem) return { count: 0, adPhone: '' };
  const username = String(profile.username || '').toLowerCase();
  const cleanUser = username.replace(/[._]/g, '');
  const fullName = String(profile.fullName || profile.full_name || '').toLowerCase().trim();
  const results = Array.isArray(adsItem.results) ? adsItem.results : [];

  if (results.length === 0) {
    // Se não veio lista de anúncios detalhada e o username tem ponto/underline, totalCount alto (>15) sem match textual costuma ser falso positivo de palavra genérica ("multimarcas", "veiculos")
    const rawTotal = Number(adsItem.totalCount || 0);
    if ((username.includes('_') || username.includes('.')) && rawTotal > 20) {
      return { count: 0, adPhone: '' };
    }
    return { count: rawTotal, adPhone: '' };
  }

  let matchedAds = 0;
  let adPhone = '';

  for (const ad of results) {
    const pageName = String(ad?.snapshot?.pageName || ad?.pageName || '').toLowerCase();
    const cleanPage = pageName.replace(/[^a-z0-9]/g, '');
    const bodyText = String(ad?.snapshot?.body?.text || '').toLowerCase();

    const isSameBusiness =
      bodyText.includes(username) ||
      (cleanPage && cleanUser.includes(cleanPage)) ||
      (cleanPage && cleanPage.includes(cleanUser)) ||
      (fullName && pageName && (fullName.includes(pageName) || pageName.includes(fullName.split('|')[0].trim())));

    if (isSameBusiness) {
      matchedAds++;
      if (!adPhone && bodyText) {
        adPhone = extractPhone(bodyText, '');
      }
    }
  }

  const finalCount = matchedAds > 0 ? Math.max(matchedAds, Number(adsItem.totalCount || matchedAds)) : 0;
  return { count: finalCount, adPhone };
}

export function qualifyLead({ inAdLibrary, activeAdsCount, whatsappNumber, followersCount, biography }) {
  let score = 0;
  const reasons = [];

  if (!inAdLibrary) {
    score += 45;
    reasons.push('Não anuncia na Biblioteca da Meta');
  } else {
    score += 10;
    reasons.push(`Já está na Biblioteca (${activeAdsCount} anúncio(s) ativo(s))`);
  }

  if (whatsappNumber) {
    score += 35;
    reasons.push('Possui WhatsApp direto identificado');
  } else {
    reasons.push('Sem WhatsApp direto na bio (abordar via DM/Link)');
  }

  if (Number(followersCount) >= 500 && biography && biography.length > 15) {
    score += 20;
    reasons.push(`Perfil ativo (${Number(followersCount).toLocaleString('pt-BR')} seguidores)`);
  } else if (Number(followersCount) > 0) {
    score += 10;
  }

  const priority = inAdLibrary ? 'BAIXA' : 'ALTA';
  const priorityLabel = inAdLibrary ? 'Não Prioritário Inicialmente' : 'Prioridade Alta';

  let closingPotential = 'BAIXO';
  if (!inAdLibrary && score >= 75) {
    closingPotential = 'ALTO';
  } else if (score >= 45) {
    closingPotential = 'MEDIO';
  }

  return {
    priority,
    priority_label: priorityLabel,
    closing_potential: closingPotential,
    closing_score: score,
    closing_reason: reasons.join(' + ')
  };
}

export function buildProspectLead(rawItem, nicheObj, locationStr) {
  const username = String(rawItem.username || '').replace(/^@/, '').trim();
  const fullName = rawItem.full_name || rawItem.fullName || rawItem.name || username;
  const biography = rawItem.biography || rawItem.bio || '';
  const externalUrl = rawItem.external_url || rawItem.externalUrl || rawItem.websiteUrl || '';
  const followersCount = Number(rawItem.followers_count ?? rawItem.followersCount ?? rawItem.followers ?? 0);
  const whatsappNumber = rawItem.whatsapp_number || rawItem.phone || extractPhone(biography, externalUrl, rawItem.businessPhoneNumber);

  const activeAdsCount = Number(rawItem.active_ads_count ?? rawItem.adsCount ?? 0);
  const inAdLibrary = Boolean(rawItem.in_ad_library ?? rawItem.hasActiveAds ?? (activeAdsCount > 0));
  const resolvedNicheId = (nicheObj && nicheObj.id) || rawItem.niche_id || 'automotivo-estetica';
  const resolvedNicheName = (nicheObj && nicheObj.name) || rawItem.niche_name || 'Estética Automotiva & Detailing';
  const resolvedLocation = locationStr || rawItem.location || rawItem.city || 'Brasil';

  const qualification = qualifyLead({
    inAdLibrary,
    activeAdsCount,
    whatsappNumber,
    followersCount,
    biography
  });

  const messageStrategy = generateFirstMessageStrategy({
    fullName,
    username,
    nicheId: resolvedNicheId,
    nicheName: resolvedNicheName,
    location: resolvedLocation,
    biography,
    inAdLibrary,
    activeAdsCount,
    whatsappNumber,
    followersCount
  });

  const customOrAutoMsg = rawItem.custom_message || messageStrategy.first_message;

  const whatsappLink = whatsappNumber
    ? `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(customOrAutoMsg)}`
    : `https://ig.me/m/${username}`;

  return {
    id: rawItem.id || `lead-${username.toLowerCase().replace(/[^a-z0-9]/g, '')}`,
    niche_id: resolvedNicheId,
    niche_name: resolvedNicheName,
    location: resolvedLocation,
    instagram: {
      username,
      full_name: fullName,
      profile_url: `https://www.instagram.com/${username}/`,
      followers_count: followersCount,
      biography,
      external_url: externalUrl
    },
    meta_ads: {
      checked_at: rawItem.checked_at || new Date().toISOString(),
      in_ad_library: inAdLibrary,
      active_ads_count: activeAdsCount,
      ad_library_status_label: inAdLibrary ? `Está na Biblioteca (${activeAdsCount} anúncios)` : 'Não está na Biblioteca',
      ad_library_url: `https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=BR&q=${encodeURIComponent(username)}`
    },
    qualification,
    message_strategy: messageStrategy,
    contact: {
      whatsapp_number: whatsappNumber,
      whatsapp_link: whatsappLink,
      personalized_message: customOrAutoMsg,
      pipeline_status: rawItem.pipeline_status || rawItem.status || 'novo',
      datacrazy_synced: Boolean(rawItem.datacrazy_synced),
      datacrazy_synced_at: rawItem.datacrazy_synced_at || null
    }
  };
}

export async function sendLeadToDataCrazy(lead, customWebhookUrl = '') {
  const env = loadEnv();
  const webhookUrl = customWebhookUrl || env.DATACRAZY_WEBHOOK_URL;
  if (!webhookUrl) {
    throw new Error('URL do Webhook DataCrazy não configurada no .env');
  }

  const rawPhone = String(lead.contact?.whatsapp_number || '').replace(/\D/g, '');
  const ddi = '55';
  const localPhone = rawPhone.startsWith('55') ? rawPhone.slice(2) : rawPhone;
  const [cidadePart, ufPart] = String(lead.location || 'Brasil - BR').split('-').map((s) => s.trim());

  const payload = {
    nome: lead.instagram.full_name,
    empresa: lead.instagram.full_name,
    email: `${lead.instagram.username}@instagram.lead.br`,
    ddi,
    telefone: localPhone || '31999999999',
    whatsapp_completo: rawPhone,
    instagram: `@${lead.instagram.username}`,
    instagram_url: lead.instagram.profile_url,
    seguidores: lead.instagram.followers_count,
    cidade: cidadePart || 'Brasil',
    uf: ufPart || 'BR',
    pais: 'Brasil',
    origem: 'Prospeccao Ativa Apify',
    nicho: lead.niche_name,
    potencial_fechamento: lead.qualification.closing_potential,
    score_fechamento: lead.qualification.closing_score,
    motivo_potencial: lead.qualification.closing_reason,
    esta_na_biblioteca_meta: lead.meta_ads.ad_library_status_label,
    anuncios_ativos_meta: lead.meta_ads.active_ads_count,
    prioridade: lead.qualification.priority,
    prioridade_descricao: lead.qualification.priority_label,
    caso_abordagem: lead.message_strategy?.case_title || '',
    primeira_mensagem_recomendada: lead.contact.personalized_message,
    link_biblioteca_meta: lead.meta_ads.ad_library_url
  };

  const resp = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  const text = await resp.text();
  if (!resp.ok) {
    throw new Error(`DataCrazy retornou ${resp.status}: ${text}`);
  }
  return { ok: true, response: text, payload };
}
