# radar-yes-funil

Cópia isolada do LeadRadar (`../leadradar`, que não foi alterado). O fluxo principal passa a ser um funil de prospeção com 4 passos: **Encontradas → Escritas → Enviadas → Respostas**.

## Publicar na Vercel
1. **Base de dados:** cria um Postgres gratuito novo (Vercel → Storage → Neon, ou neon.tech / supabase.com) só para esta cópia. Copia a connection string (`postgres://…?sslmode=require`).
2. **Projeto:** Vercel → Add New → Project → importa este repositório e define **Root Directory = `radar-yes-funil`**. É um projeto novo, separado do LeadRadar original.
3. **Variáveis:** `DATABASE_URL` = a connection string (marcada como Sensitive). Se usares a integração Neon da Vercel, ela é criada automaticamente.
4. **Deploy.** As tabelas são criadas no primeiro pedido.
5. **Utilizadores** (no teu computador, com a mesma `DATABASE_URL`):
   ```bash
   cd radar-yes-funil && npm ci
   DATABASE_URL='postgres://…' npm run user -- add dona dono "Ana"
   DATABASE_URL='postgres://…' npm run user -- add rui membro "Rui"
   ```

**Como funciona na Vercel:** as funções são efémeras, por isso a pesquisa e a escrita avançam por passos curtos (`/api/campaigns/:id/step` e `/api/write`) que o separador aberto vai pedindo. O estado fica todo no Postgres: fechar a página pausa a pesquisa e reabrir retoma-a. Cada passo dura menos de 60 s (o pedido ao OpenStreetMap tem um timeout de 45 s e 3 tentativas).

## Correr localmente
```bash
cp .env.example .env            # DATABASE_URL de um Postgres local ou de desenvolvimento
npm ci && npm start             # http://localhost:4317
```

## Testes
- `npm test`: unitários, de integração e do handler da Vercel. Precisa de um Postgres em `TEST_DATABASE_URL` (por omissão `postgres://postgres@127.0.0.1:5433/postgres`) e cria uma BD nova por execução.
- `npm run e2e`: Playwright a 1280 e 390 px.

## Arquitetura
- `api/index.mjs`: função da Vercel (todas as rotas `/api/*`).
- `server/`: router, sessões (cookie `rfunil_sid`, HttpOnly, SameSite=Strict, Secure na Vercel), papéis dono/membro, regras do funil, rate limit guardado no Postgres e pesquisa Overpass que reutiliza `public/assets/js/{overpass,leads,data}.js`.
- `public/`: interface do funil, Modo Sprint e o mapa clássico (`classico.html`).
