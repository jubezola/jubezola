# Iguarias no Ponto — website

Site one-page do restaurante Iguarias no Ponto (Coimbra). Next.js 16 (App Router), TypeScript e Tailwind CSS 4.

## Correr localmente

```bash
cd iguarias-no-ponto
npm install
npm run dev          # http://localhost:3000
npm run build && npm start   # versão de produção
```

## Testes

```bash
npm test                                   # lógica: horário/Aberto-Fechado, validação do formulário, mensagem WhatsApp, ementa
npx playwright install chromium            # 1.ª vez (requer: npm i -D playwright)
npm run build && npm start &               # depois, testes no navegador:
BASE_URL=http://localhost:3000 node tests/e2e/site.e2e.cjs
```

## Editar a ementa do dia

Ficheiro **`data/menu.json`**:

```json
{
  "atualizado": "2026-11-25",
  "nota": "Texto opcional mostrado por baixo da ementa.",
  "pratos": [
    { "prato": "Sopa de agrião", "descricao": "Sopa caseira do dia.", "tipo": "sopa", "preco": "" }
  ]
}
```

- `tipo`: `sopa`, `carne`, `peixe` ou `vegetariano` (os pratos aparecem agrupados por esta ordem).
- `descricao` e `preco` são opcionais. O preço só aparece se preenchido (`"8.5"` aparece como `8,50 €`; texto livre fica como está).
- `atualizado`: data da ementa (AAAA-MM-DD), mostrada no site.
- Entradas inválidas são ignoradas (com aviso no build) em vez de partirem o site.

Forma mais simples: editar o ficheiro no GitHub (ícone do lápis) e guardar. A Vercel publica a nova versão automaticamente em ~1 minuto.

## Dados do restaurante

Tudo num só sítio: `lib/site.ts` (morada, telefones, WhatsApp, redes sociais, eatbu) e `lib/hours.ts` (horário).
O número de WhatsApp está numa única constante: `WHATSAPP_NUMBER`.

## Publicar na Vercel

1. Vercel → Add New → Project → importar o repositório.
2. **Root Directory: `iguarias-no-ponto`** (o repositório tem outros projetos na raiz).
3. Framework: Next.js (detetado automaticamente). Deploy.
4. Com domínio próprio, definir `NEXT_PUBLIC_SITE_URL` (ex.: `https://www.dominio.pt`) para canonical, Open Graph e sitemap.

## Variáveis de ambiente (ver `.env.example`)

| Variável | Obrigatória | Para quê |
|---|---|---|
| `NEXT_PUBLIC_SITE_URL` | Não (na Vercel usa o URL de produção) | URL canónico, OG, sitemap |
| `RESEND_API_KEY` | Só para email | Chave da API Resend |
| `ORDER_EMAIL_TO` | Só para email | Email que recebe os pedidos |
| `ORDER_EMAIL_FROM` | Só para email | Remetente (domínio verificado na Resend) |

O formulário de catering envia pelo **WhatsApp** (abre `wa.me` com a mensagem preenchida). A rota `app/api/encomenda`
está pronta para email (validação partilhada, honeypot, limite por IP, timeout), mas responde `501` até as três variáveis estarem definidas
e só é usada se o formulário passar a fazer `POST /api/encomenda`.

## Estrutura

```
app/            layout (fontes, metadados), page, sitemap, robots, imagem OG, ícone, api/encomenda
components/     Header, OpenBadge, CateringForm, HoursTable, MapEmbed, MobileActionBar, Icons, sections/*
lib/            site.ts (dados), hours.ts (horário + Aberto/Fechado), order.ts (validação + mensagem), menu*.ts, schema.ts
data/menu.json  ementa do dia
public/images/  fotografias
tests/          testes unitários (node:test) e e2e (Playwright)
```

## Notas

- O badge Aberto/Fechado usa o fuso Europe/Lisbon (hora de verão incluída). Feriados não são considerados.
- O mapa do Google só carrega depois de o visitante tocar em "Mostrar mapa" (sem cookies de terceiros sem consentimento e mais rápido).
  Mostra a morada por pesquisa de texto; as coordenadas exatas não foram confirmadas.
