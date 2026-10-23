---
fonte: assistente
cssclasses:
  - autoria-assistente
atualizado: 2026-10-22
---

# ⚖️ gemini.md — Constituição do Projeto (Prospecção Ativa Apify)

> Este documento é a **Lei do Projeto** segundo o **Protocolo V.L.A.E.G.** e a arquitetura de 3 camadas **A.N.T.** (`architecture/`, Navegação, `tools/`).

---

## 1. Invariantes Arquiteturais (A.N.T.)
1. **Camada 1 — Arquitetura (`architecture/`):** Todo procedimento operacional (POP) é documentado em Markdown antes de ir para o código. Se a lógica mudar, atualiza-se o POP primeiro.
2. **Camada 2 — Navegação:** O Agente atua como roteador determinístico entre o MCP da Apify, os scripts em `tools/`, a Fonte da Verdade (Supabase / Google Sheets) e a interface web.
3. **Camada 3 — Ferramentas (`tools/`):** Scripts determinísticos, atômicos e testáveis. Arquivos brutos de raspagem ficam exclusivamente em `.tmp/`. Segredos/chaves ficam em `.env` (jamais versionados ou expostos em notas do vault).

---

## 2. Regras Comportamentais de Negócio (Aprovadas na Fase 1)
1. **Classificação de Anúncios (Sem Descarte Cego):**
   - O sistema pesquisa perfis comerciais no Instagram dentro do nicho escolhido e cruza cada perfil na Biblioteca de Anúncios da Meta (`Meta Ads Library`).
   - **Se NÃO anuncia (`has_active_ads: false`):** Marcado como **"Não Anuncia"** e recebe **Prioridade Alta** (Lead principal para oferecer tráfego pago do zero).
   - **Se JÁ anuncia (`has_active_ads: true`):** **Não é excluído!** É marcado visivelmente como **"Está na Biblioteca (Já Anuncia)"** e recebe **Prioridade Baixa (Não Prioritário Inicialmente)**, podendo ser filtrado na tela a qualquer momento.
2. **Score de Potencial de Fechamento (`closing_potential`):**
   - Cada lead recebe uma avaliação automática do seu potencial de fechamento (`ALTO`, `MEDIO`, `BAIXO`) e motivos claros baseados em:
     - Não estar anunciando na Biblioteca da Meta (+40 pts)
     - Ter WhatsApp identificado na bio ou link externo (+35 pts)
     - Ter perfil estruturado / seguidores ativos no nicho (+25 pts)
3. **Seletor de Nichos (Foco Inicial: Automotivo):**
   - Permite selecionar subnichos automotivos (*Estética Automotiva/Detailing*, *Lojas de Seminovos/Multimarcas*, *Oficinas Mecânicas/Centros Automotivos*, *Som/Insulfilm/Acessórios*) ou cadastrar qualquer outro nicho e cidade sob demanda.
4. **Ação Direta via WhatsApp:**
   - Cada lead exibe o botão de 1 clique (`wa.me/55...`) com mensagem personalizada de abordagem pronta para disparo.

---

## 3. Esquema de Dados Aprovado (JSON Data Schema)

### 3.1. Payload de Entrada (Consulta de Prospecção — `SearchInput`)
```json
{
  "niche_id": "automotivo-estetica",
  "niche_name": "Estética Automotiva & Detailing",
  "search_terms": ["estetica automotiva", "polimento automotivo", "vitrificacao"],
  "location": "Belo Horizonte - MG",
  "max_results": 20
}
```

### 3.2. Payload Intermediário (`.tmp/raw_leads.json`)
Dados brutos retornados pelo MCP Apify (Instagram Scraper + Meta Ads Library Scraper) antes da higienização e cálculo de score.

### 3.3. Payload de Saída (Lead Qualificado no App e Banco — `ProspectLead`)
```json
{
  "id": "lead-001",
  "niche_id": "automotivo-estetica",
  "niche_name": "Estética Automotiva & Detailing",
  "location": "Belo Horizonte - MG",
  "instagram": {
    "username": "primegarage.detail",
    "full_name": "Prime Garage Estética Automotiva",
    "profile_url": "https://www.instagram.com/primegarage.detail/",
    "followers_count": 4820,
    "biography": "Especialistas em Vitrificação e PPF...",
    "external_url": "https://wa.me/5531999887766"
  },
  "meta_ads": {
    "checked_at": "2026-10-22T18:32:00Z",
    "in_ad_library": false,
    "active_ads_count": 0,
    "ad_library_status_label": "Não está na Biblioteca",
    "ad_library_url": "https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=BR&q=primegarage.detail"
  },
  "qualification": {
    "priority": "ALTA",
    "closing_potential": "ALTO",
    "closing_score": 95,
    "closing_reason": "Não anuncia na Meta Ads + Possui WhatsApp direto na bio + Perfil automotivo ativo"
  },
  "contact": {
    "whatsapp_number": "5531999887766",
    "whatsapp_link": "https://wa.me/5531999887766?text=...",
    "pipeline_status": "novo"
  }
}
```

---

## 4. Log de Manutenção
- `2026-10-22 18:26`: Inicialização da Constituição `gemini.md` na Fase 0 do Protocolo V.L.A.E.G.
- `2026-10-22 18:32`: Fase 1 (Visão) aprovada pelo usuário. Adicionado campo `qualification` (`priority`: ALTA/BAIXA, `closing_potential`: ALTO/MEDIO/BAIXO) e regra para manter anunciantes marcados como "Está na Biblioteca" com baixa prioridade inicial.
- `2026-10-22 19:50`: Fase 2 (Link) concluída. MCP da Apify (`salleswork`) e Webhook de Negócios do CRM DataCrazy conectados e validados via `tools/handshake_link.mjs`.
- `2026-10-22 20:15`: Fase 3 (Arquitetura) e Fase 4 (Estilo) implementadas com visual Qatchup + Roxo/Azul Codex (`#7c5cff` → `#5f8cff`) e ícones Puffy 3D em SVG, zero verde-lima.
- `2026-10-22 21:50`: Loop de Autocorreção executado na pesquisa e abordagem:
  - Filtro de saúde do perfil (`checkProfileHealth`): descarta contas abandonadas (último post `< 2025`), contas vazias (`< 150` seguidores), franquias nacionais (`> 250k` seguidores), vendedores individuais (`Sales Executive`), termos fora do nicho (moda/notícias) e empresas sem vínculo com a cidade buscada.
  - Extração automática de WhatsApp dentro de `linktr.ee`, `linkbio.co` e `bio.site` (`resolveBioLinkWhatsApp`), ignorando telefones fixos sem dígito `9`.
  - Validação de correspondência real na Biblioteca da Meta (`parseMetaAdsResultForProfile`) eliminando falsos positivos de `@username` com `_` ou `.`.
  - Mensagens de 1ª abordagem 100% humanas e naturais por caso (`generateFirstMessageStrategy`), sem variáveis robóticas.
  - Botão de exclusão de leads inexistentes (`DELETE /api/leads/:id`) com lista de bloqueio persistente (`deletedUsernames`).
- `2026-10-22 22:58`: Fase 5 (Gatilho / Implantação) concluída. Adicionado Agendador Automático em background (`POST /api/trigger/config`), modal de Piloto Automático no Dashboard e inicializador de 1 clique (`Iniciar-Prospector.bat`).
