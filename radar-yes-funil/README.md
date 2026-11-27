# radar-yes-funil

Cópia isolada do LeadRadar (`../leadradar`, que não foi alterado). O fluxo principal passa a ser um funil de prospeção com 4 passos: **Encontradas → Escritas → Enviadas → Respostas**.

## Correr
```bash
cp .env.example .env                                     # PORT=4317, DB_FILE=data/funil.db
npm run user -- add dona dono "Ana"                      # pede a palavra-passe (ou PASSWORD=... no ambiente)
npm run user -- add rui membro "Rui"
npm start                                                # http://localhost:4317
```
Precisa de Node ≥ 22.9 e não tem dependências (usa `node:sqlite` e `node:http`). O mapa clássico fica em `/classico.html`.

## Testes
- `npm test`: unitários e de integração (Overpass simulado).
- `npm run e2e`: Playwright a 1280 e 390 px.

## Arquitetura
- `server/`: API com sessão (cookie `rfunil_sid`, HttpOnly, SameSite=Strict), papéis dono/membro, SQLite próprio, pesquisa Overpass no servidor (reutiliza `public/assets/js/{overpass,leads,data}.js`), escrita em pipeline (concorrência 4, 3 tentativas com backoff), rate limit e transições validadas.
- `public/index.html` + `assets/js/funil/`: interface do funil, Modo Sprint e definições.
