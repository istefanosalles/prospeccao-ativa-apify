---
fonte: assistente
cssclasses:
  - autoria-assistente
atualizado: 2026-10-22
---

# 📋 Task Plan — Sistema de Prospecção Ativa (Protocolo V.L.A.E.G.)

## 🎯 Objetivo Principal
Sistema determinístico e autorregenerativo de prospecção ativa que utiliza o MCP e API da Apify para buscar perfis comerciais no Instagram por nicho (iniciando no **Nicho Automotivo**), verificar na **Biblioteca de Anúncios da Meta** se o cliente já anuncia, classificar o **Potencial de Fechamento**, listar no Dashboard com botão de abordagem direta no WhatsApp e enviar os leads diretamente para o CRM **DataCrazy**.

---

## 🗺️ Fases do Protocolo V.L.A.E.G.

### 🟢 Protocolo 0: Inicialização (Concluído ✅)
- [x] Criar estrutura do projeto em `04_PROJETOS/prospeccao-ativa-apify/` (`architecture/`, `tools/`, `.tmp/`).
- [x] Inicializar `task_plan.md`, `findings.md`, `progress.md` e `gemini.md` (Constituição do Projeto).

### 🏗️ Fase 1: V — Visão e Lógica (Concluído ✅)
- [x] Definir Esquema de Dados JSON (Entrada/Saída) em `gemini.md`.
- [x] Confirmar Regras Comportamentais:
  - Se está na Biblioteca de Anúncios → marcar como **"Está na Biblioteca"** e colocar como **Não Prioritário Inicialmente**.
  - Se não está na Biblioteca → marcar como **Prioridade Alta**.
  - Identificar se o lead tem **Potencial de Fechamento** (`ALTO`, `MÉDIO`, `BAIXO` + diagnóstico).
  - Definir o CRM **DataCrazy** como destino dos negócios via Webhook.

### ⚡ Fase 2: L — Link (Conectividade — Concluído ✅)
- [x] Conectar o MCP da Apify + Token no `.env` (`✅ [APIFY CONECTADA] Usuário: salleswork`).
- [x] Configurar e mapear o Webhook de Entrada de Negócios do **CRM DataCrazy** (`✅ [DATACRAZY WEBHOOK CONECTADO] Status 200: {"ok":true}`).
- [x] Testar chamada real via MCP da Apify (`apify--instagram-search-scraper` + `apify--facebook-ads-scraper`).

### ⚙️ Fase 3: A — Arquitetura (3 Camadas A.N.T. — Concluído ✅)
- [x] **Camada 1 (`architecture/`):** POPs técnicos em Markdown:
  - [[04_PROJETOS/prospeccao-ativa-apify/architecture/01-pesquisa-instagram-por-nicho|01-pesquisa-instagram-por-nicho.md]]
  - [[04_PROJETOS/prospeccao-ativa-apify/architecture/02-verificacao-meta-ads-library|02-verificacao-meta-ads-library.md]]
  - [[04_PROJETOS/prospeccao-ativa-apify/architecture/03-qualificacao-e-datacrazy|03-qualificacao-e-datacrazy.md]]
- [x] **Camada 2 (Navegação):** Orquestração entre o MCP Apify, os scripts determinísticos e o CRM DataCrazy.
- [x] **Camada 3 (`tools/`):** Motores determinísticos `handshake_link.mjs`, `prospector_engine.mjs` e `server.mjs` usando `.tmp/` para intermediários.

### ✨ Fase 4: E — Estilo (Refinamento e UI — Concluído ✅)
- [x] Construir Dashboard Web (`tools/dashboard.html`) com seletor de nicho (Automotivo e subnichos + modal para adicionar novos nichos).
- [x] Destaque visual de **Potencial de Fechamento**, etiqueta **"Está na Biblioteca / Não está na Biblioteca"**, aba de prioridade e botões diretos para **Chamar no WhatsApp** e **Enviar p/ DataCrazy**.
- [x] Entregar link clicável do aplicativo (`http://localhost:3099`).

### 🛰️ Fase 5: G — Gatilho (Implantação e Automação — Concluído ✅)
- [x] Gatilho de auto-envio para o CRM DataCrazy integrado diretamente na busca de prospecção.
- [x] Log de Manutenção atualizado em `gemini.md`.
