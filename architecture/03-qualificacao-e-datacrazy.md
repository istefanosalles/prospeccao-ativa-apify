---
fonte: assistente
cssclasses:
  - autoria-assistente
atualizado: 2026-10-22
---

# POP 03 — Qualificação de Potencial de Fechamento, Primeira Mensagem por Caso e Envio ao DataCrazy

## 1. Objetivo
Calcular deterministicamente se o lead possui **Alto, Médio ou Baixo Potencial de Fechamento**, selecionar automaticamente **qual a primeira mensagem exata de abordagem** baseada na situação real daquele lead (Nicho + Se anuncia ou não na Biblioteca da Meta + Canal disponível + Seguidores/Bio) e enviar ao CRM **DataCrazy**.

## 2. Cálculo Determinístico do Potencial de Fechamento (`closing_score`)
- **+45 pontos:** Não possui anúncio ativo na Biblioteca da Meta (`in_ad_library == false`).
- **+35 pontos:** Possui número de WhatsApp válido identificado na bio ou link externo.
- **+20 pontos:** Perfil ativo e estruturado no nicho (`followers_count >= 500` e biografia preenchida).

---

## 3. Matriz da Primeira Mensagem por Caso (`first_message_strategy`)

O motor analisa cada lead individualmente e escolhe entre **4 cenários de abordagem**:

### Caso 1: NÃO está na Biblioteca da Meta + Tem WhatsApp Direto (`CASO_1_NAO_ANUNCIA_ZAP`)
- **Diagnóstico:** Tem estrutura de atendimento no WhatsApp e bom Instagram, mas depende 100% do orgânico/indicação.
- **Ângulo da 1ª Mensagem:** Elogio genuíno ao trabalho no Instagram + Alerta consultivo de que pesquisou na região/Biblioteca da Meta e viu que eles não estão com campanhas ativas captando clientes novos todos os dias + Pergunta leve de permissão.

### Caso 2: NÃO está na Biblioteca da Meta + Sem WhatsApp na Bio (`CASO_2_NAO_ANUNCIA_DM`)
- **Diagnóstico:** Não faz tráfego pago e ainda dificulta o contato do cliente no perfil (link genérico ou sem link).
- **Ângulo da 1ª Mensagem (DM / Link):** Abordagem rápida mostrando que o trabalho no perfil é muito bom, mas que hoje quem procura pelo serviço na região não encontra anúncios deles e nem um botão direto de orçamento + Pede o contato do responsável.

### Caso 3: ESTÁ na Biblioteca da Meta (Poucos anúncios: 1 a 3) (`CASO_3_ANUNCIA_POUCO`)
- **Diagnóstico:** Já entende o valor do tráfego pago (não precisa ser educado do zero), mas roda poucos criativos ou apenas botão impulsionar sem funil de qualificação/CRM.
- **Ângulo da 1ª Mensagem:** Parabeniza por já estarem anunciando na Biblioteca da Meta, mas pergunta se os leads que chegam no WhatsApp estão vindo qualificados ou só curiosos perguntando preço (oferta de otimização + automação/IA no atendimento).

### Caso 4: ESTÁ na Biblioteca da Meta (Muitos anúncios: 4+) (`CASO_4_ANUNCIA_ESCALA`)
- **Diagnóstico:** Empresa que já investe forte em tráfego pago e recebe alto volume de mensagens.
- **Ângulo da 1ª Mensagem:** Não oferecer "subir campanha básica", e sim **conversão de atendimento / Agente de IA / CRM** para não perder os leads que eles já pagam caro na Meta para trazer.
