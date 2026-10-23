---
fonte: assistente
cssclasses:
  - autoria-assistente
atualizado: 2026-10-22
---

# 🔍 Findings — Descobertas e Restrições Técnicas

## 1. Contexto do Vault (Salles Brain)
- O protocolo oficial exigido pelo usuário está documentado em [[05_CONHECIMENTO/Importado-do-Notion/12-Cursos/protocolo-v-l-a-e-g--844478f8|Protocolo V.L.A.E.G.]].
- Regra estrita do **Protocolo 0 e Fase 1** cumprida: Perguntas de Descoberta respondidas e JSON Data Schema aprovado em `gemini.md`.

## 2. Integração com Apify (MCP & Actors)
- O usuário forneceu a configuração do MCP da Apify:
  - URL base enviada: `https://mcp.apify.com/?tools=fetch-actor-details,apify/instagram-profile-scraper`
- **Restrições Técnicas Identificadas na Fase 2 (Link):**
  1. **Formato do `mcp_config.json` no Antigravity:** Conforme a documentação oficial do Antigravity (`mcp_servers.md`), servidores remotos usam a chave `"serverUrl"` (ex.: `"serverUrl": "https://mcp.apify.com/..."`) e exigem o cabeçalho `"Authorization": "Bearer <APIFY_API_TOKEN>"`.
  2. **Actors necessários na query `?tools=`:** Além de `apify/instagram-profile-scraper`, precisamos incluir o Actor de busca por nicho (`apify/instagram-search-scraper` ou `apify/instagram-scraper`) e o Actor da Biblioteca de Anúncios da Meta (`apify/facebook-ads-scraper`) na URL do MCP para que o agente possa consultar tanto o Instagram quanto a Biblioteca de Anúncios da Meta.

## 3. Fonte da Verdade: Supabase
- O usuário escolheu o **Supabase** como Fonte da Verdade principal.
- Necessário na Fase 2 (Link): `SUPABASE_URL` e `SUPABASE_ANON_KEY` (ou `SUPABASE_SERVICE_ROLE_KEY`) no arquivo `.env` de `04_PROJETOS/prospeccao-ativa-apify/.env`, além da criação da tabela `prospect_leads`.
