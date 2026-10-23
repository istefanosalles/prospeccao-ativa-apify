---
fonte: assistente
cssclasses:
  - autoria-assistente
atualizado: 2026-10-22
---

# POP 01 — Pesquisa de Perfis no Instagram por Nicho

## 1. Objetivo
Localizar perfis comerciais ativos no Instagram pertencentes ao nicho e cidade selecionados pelo usuário (iniciando no **Nicho Automotivo**: Estética Automotiva, Seminovos, Oficinas, Som/Película, ou qualquer nicho cadastrado) e extrair dados de perfil e contato (biografia, seguidores, link externo e telefone/WhatsApp).

## 2. Entradas
- `niche_id`: Identificador do nicho (ex.: `automotivo-estetica`).
- `search_terms`: Termos de busca do nicho (ex.: `estetica automotiva`, `polimento automotivo`).
- `location`: Cidade/UF alvo (ex.: `Belo Horizonte - MG`).
- `max_results`: Limite de perfis por consulta.

## 3. Ferramentas Utilizadas (MCP Apify / API)
1. `apify/instagram-search-scraper` (`searchType: "user"`) para localizar contas por palavra-chave + cidade.
2. `apify/instagram-profile-scraper` para enriquecer biografia, seguidores e `externalUrl` quando necessário.

## 4. Regras de Extração de WhatsApp
- Verificar links `wa.me/55...` ou `api.whatsapp.com/send?phone=55...` no campo `externalUrl` e `biography`.
- Verificar padrões de telefone brasileiro `(DDD) 9XXXX-XXXX` na biografia e normalizar com DDI `55`.
- Salvar o resultado intermediário em `.tmp/ig_profiles.json`.
