# 🚀 Salles Prospector — Prospecção Ativa (Instagram + Meta Ads + DataCrazy)

Sistema determinístico de prospecção ativa construído sob o **Protocolo V.L.A.E.G.** (*Visão, Link, Arquitetura, Estilo, Gatilho*) que encontra empresas no Instagram via **Apify**, verifica se já anunciam na **Biblioteca de Anúncios da Meta (`Meta Ads Library`)**, extrai o WhatsApp real (inclusive de dentro de links `linktr.ee` / `linkbio`), gera a **1ª mensagem humanizada** de acordo com o cenário do lead e envia direto para o CRM **DataCrazy**.

🌐 **Acesse online (Vercel):** **[https://prospeccao-ativa-apify.vercel.app](https://prospeccao-ativa-apify.vercel.app)**

---

## ✨ Principais Funcionalidades

1. **Busca Cirúrgica no Instagram (`apify/instagram-search-scraper`):**
   - Filtro automático que descarta perfis inativos/abandonados (último post anterior a 2025), contas vazias (`< 150` seguidores), franquias nacionais (`> 250 mil` seguidores), perfis de vendedores pessoa física e empresas sem vínculo com a cidade pesquisada.
2. **Extrator Profundo de WhatsApp:**
   - Identifica apenas números de celular válidos (com dígito `9` após o DDD, ignorando telefones fixos).
   - Entra automaticamente em segundo plano nos links de bio (`linktr.ee`, `linkbio.co`, `bio.site`, `beacons.ai`) para destravar o WhatsApp real da empresa.
3. **Verificação na Biblioteca de Anúncios da Meta (`apify/facebook-ads-scraper`):**
   - **Não está na Biblioteca (0 anúncios):** Classificado como **Prioridade Alta** (lead ideal para oferecer tráfego pago).
   - **Está na Biblioteca (Já anuncia):** Mantido na base como **Não Prioritário Inicialmente**, com foco em escala ou automação de atendimento com IA.
4. **1ª Mensagem Humanizada por Caso (4 Cenários):**
   - **Caso 1 (Não Anuncia + Tem WhatsApp):** Quebra-gelo natural perguntando quem cuida do comercial/marketing antes de falar de serviço.
   - **Caso 2 (Não Anuncia + Sem WhatsApp):** Mensagem curta para Direct pedindo o número de WhatsApp da loja.
   - **Caso 3 (Já Anuncia — 1 a 4 anúncios):** Abordagem comentando que viu o anúncio rodando e perguntando sobre a qualificação dos leads.
   - **Caso 4 (Já Anuncia Forte — 5+ anúncios):** Foco em velocidade de atendimento no WhatsApp e follow-up automático com IA.
5. **Integração Nativa com CRM DataCrazy + Exclusão com Bloqueio:**
   - Envio individual, em lote ou automático via Webhook para o **DataCrazy**.
   - Botão **Apagar** que remove leads inexistentes e adiciona o `@username` na lista de bloqueio para nunca mais voltar em buscas futuras.

---

## 🛠️ Como Usar no Dia a Dia (Passo a Passo)

### Passo 1 — Escolher o Nicho e a Cidade
No painel principal do Dashboard:
1. Selecione o **Nicho** (ex.: *Loja de Veículos & Seminovos*, *Estética Automotiva*, *Oficinas Mecânicas*) ou clique em **"+ Novo Nicho"** no topo para cadastrar qualquer mercado.
2. Digite o **Termo de Busca** (ex.: `seminovos`, `estetica automotiva`) ou clique em um dos atalhos rápidos.
3. Informe a **Cidade / Estado** (ex.: `Petrolina - PE`, `Recife - PE`, `Belo Horizonte - MG`).
4. Escolha o **Limite de Perfis** por rodada e clique em **"Prospectar Agora"**.

### Passo 2 — Filtrar e Abordar os Leads
- Use as abas para alternar entre:
  - **Prioridade Alta: Não Anunciam** *(foco imediato de fechamento)*
  - **Todos os Leads**
  - **Está na Biblioteca (Não Prioritários Inicialmente)**
- Em cada card você pode:
  - Editar a **1ª Mensagem Recomendada** se desejar (ela atualiza o link do botão automaticamente);
  - Clicar em **"Chamar no WhatsApp"** (ou **"Abordar no Instagram"** quando o lead só atende via Direct);
  - Clicar em **"Enviar p/ DataCrazy"** para criar o negócio no CRM;
  - Clicar em **"Apagar"** caso o perfil seja inexistente ou não faça sentido (ele fica bloqueado para não aparecer de novo).

### Passo 3 — Ativar o Piloto Automático (Gatilho)
1. Clique no botão **"⚡ Gatilho"** no canto superior direito.
2. Marque **"Ativar Gatilho Recorrente em Segundo Plano"**.
3. Defina o intervalo (**a cada 6h, 12h ou 24h**), o termo e a cidade-alvo.
4. Deixe marcada a opção de enviar automaticamente os leads de **Prioridade Alta** para o **CRM DataCrazy** e clique em **"Salvar Gatilho"**.

---

## 💻 Como Rodar Localmente

### 1. Configurar variáveis de ambiente (`.env`)
Crie um arquivo `.env` na raiz do projeto com:
```env
APIFY_API_TOKEN=seu_token_da_apify
DATACRAZY_WEBHOOK_URL=sua_url_de_webhook_do_datacrazy
```

### 2. Iniciar com 1 Clique (Windows)
Dê dois cliques no arquivo **`Iniciar-Prospector.bat`** ou rode no terminal:
```bash
npm start
```
O sistema ficará disponível em **`http://localhost:3099`**.

---

## 📂 Estrutura da Arquitetura (A.N.T. + V.L.A.E.G.)

```text
├── api/
│   └── index.mjs                  # Entrypoint Serverless para a Vercel
├── architecture/                  # Camada 1: POPs Técnicos
│   ├── 01-pesquisa-instagram-por-nicho.md
│   ├── 02-verificacao-meta-ads-library.md
│   └── 03-qualificacao-e-datacrazy.md
├── tools/                         # Camada 3: Motores Determinísticos
│   ├── prospector_engine.mjs      # Filtros, extrator Linktree, mensagens e DataCrazy
│   ├── server.mjs                 # Servidor HTTP + Agendador de Gatilho
│   ├── dashboard.html             # Interface Web (Estilo Qatchup + Codex)
│   └── handshake_link.mjs         # Teste de conectividade Apify + DataCrazy
├── .tmp/                          # Banco local e arquivos intermediários
├── gemini.md                      # Constituição do Projeto e Log de Manutenção
├── Iniciar-Prospector.bat         # Inicializador rápido de 1 clique (Windows)
└── vercel.json                    # Configuração de roteamento e deploy Vercel
```
