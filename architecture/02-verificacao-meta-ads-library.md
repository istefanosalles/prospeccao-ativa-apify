---
fonte: assistente
cssclasses:
  - autoria-assistente
atualizado: 2026-10-22
---

# POP 02 — Verificação na Biblioteca de Anúncios da Meta

## 1. Objetivo
Consultar a **Biblioteca de Anúncios da Meta (`Meta Ads Library`)** para cada perfil encontrado no Instagram e verificar se a empresa possui anúncios ativos no momento.

## 2. Entradas
- `username`: Nome de usuário do Instagram.
- `full_name`: Nome comercial da empresa.

## 3. Ferramenta Utilizada (MCP Apify / API)
- Actor: `apify/facebook-ads-scraper`
- URL de consulta:
  `https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=BR&q=<username_ou_nome>`

## 4. Regras Comportamentais (Definidas pelo Usuário na Fase 1)
1. **Não está na Biblioteca (`active_ads_count == 0`):**
   - `in_ad_library`: `false`
   - `ad_library_status_label`: `"Não está na Biblioteca"`
   - `priority`: `"ALTA"` (Prioridade máxima de prospecção).
2. **Está na Biblioteca (`active_ads_count > 0`):**
   - **NÃO excluir o lead.**
   - `in_ad_library`: `true`
   - `ad_library_status_label`: `"Está na Biblioteca"`
   - `priority`: `"BAIXA"` (Marcado como **Não Prioritário Inicialmente**).
