# LeadRadar Portugal

Ferramenta para encontrar **negócios sem website** em todos os distritos de Portugal, com **WhatsApp, Instagram ou telefone** prontos a contactar. Feita para quem vende websites.

- **20 distritos e regiões** (18 distritos + Açores + Madeira) e **308 concelhos**, num mapa de azulejos.
- **Tempo real**: cada pesquisa vai ao OpenStreetMap através da Overpass API (dados atualizados ao minuto). A lista volta a atualizar-se sozinha (5, 10, 30 ou 60 minutos) e marca como **Novo** cada negócio que aparece.
- **Varredura nacional**: um botão analisa o país inteiro, distrito a distrito.
- **Contacto com um toque**: o WhatsApp abre com a mensagem já escrita com o nome do negócio; no Instagram a mensagem fica copiada para o Direct; telemóvel e fixo com botão de ligar.
- **Pontuação de cada lead** (quente, morno, frio) conforme o canal de contacto, a atividade no Instagram, o horário publicado e o tipo de negócio.
- **Mais leads do que "sem website"**: também apanha negócios cujo "site" é só uma página de Facebook/Instagram/Linktree, ou um site do Google (`*.business.site`) que a Google desligou em 2024. Estes aparecem destacados a amarelo.
- **Sem duplicados**: o mesmo negócio registado duas vezes no OpenStreetMap (ponto + edifício) aparece uma só vez, com os contactos juntos.
- **Pipeline de vendas** (Guardado → Contactado → Interessado → Fechado / Perdido) com notas, valor da proposta, receita e taxa de resposta.
- **Seguimentos**: ao contactar alguém, fica marcado um seguimento para daqui a 3 dias (podes mudar: amanhã, 3 dias, 1 semana ou outra data). O separador Pipeline mostra quantos tens para hoje.
- **Contactar em sequência**: na ficha, "Seguinte" (ou as setas ← →) passa para o próximo negócio da lista. Depois de enviar o WhatsApp, o foco fica em "Seguinte": basta carregar Enter.
- **WhatsApp Web direto**: no computador, o WhatsApp abre no WhatsApp Web sem a página intermédia do wa.me, e sempre no mesmo separador (pode mudar-se nas Definições).
- **Saudação automática**: a variável `{saudacao}` escreve "Bom dia", "Boa tarde" ou "Boa noite" conforme a hora.
- **Filtros lembrados** (canal, temperatura, ordem) entre visitas; tecla `/` vai para a pesquisa.
- **Lista "não contactar" (RGPD)**: na ficha, "Pediu para não ser contactado" esconde o negócio de todas as pesquisas e relatórios, mesmo que volte a aparecer com outro registo do mesmo telefone.
- **Relatório geral**: PDF, Excel (5 folhas), CSV, envio por email e resumo para o teu WhatsApp.
- Mapa com agrupamento de marcadores, modo escuro, funciona em telemóvel, sem login nem base de dados.

---

## Publicar no Netlify (5 minutos)

### Opção A: a partir do GitHub (recomendada)

1. Entra em [app.netlify.com](https://app.netlify.com) → **Add new site** → **Import an existing project** → GitHub.
2. Escolhe este repositório e o ramo onde está o código.
3. Não mudes nada: o ficheiro `netlify.toml` na raiz já diz ao Netlify o que publicar. Carrega em **Deploy**.
4. Pronto. O site fica em `https://nome-que-escolheres.netlify.app`. Em **Domain management** podes ligar um domínio teu.

### Opção B: arrastar a pasta

Arrasta a pasta `leadradar/public` para [app.netlify.com/drop](https://app.netlify.com/drop). Funciona tudo, exceto o envio automático por email e a proteção por palavra-passe (essas precisam da Opção A).

---

## Para vender acessos

### Proteger o site com utilizador e palavra-passe

No Netlify: **Site configuration → Environment variables → Add a variable**

| Variável | Exemplo | Para quê |
|---|---|---|
| `SITE_USERS` | `joao:Senha123,maria:Outra456` | Cada cliente recebe o seu par `utilizador:palavra-passe`. |

Depois de mudar variáveis, faz **Deploys → Trigger deploy**. Para cortar o acesso de alguém, remove-o da lista e volta a fazer deploy. Sem esta variável, o site fica aberto.

### Mudar o nome e a marca

Edita `leadradar/public/assets/js/config.js`:

- `brand`: nome da ferramenta (aparece no topo, nos relatórios e nos emails);
- `supportEmail`: email de suporte no rodapé;
- `defaults`: preço por omissão de um site, número máximo de resultados, intervalo de atualização;
- `TEMPLATES`: as mensagens de WhatsApp e Instagram (variáveis `{nome}` `{cidade}` `{categoria}` `{meu_nome}` `{preco}` `{saudacao}`).

As cores estão no início de `leadradar/public/assets/css/app.css` (variáveis `--cobalt`, `--tram`, etc.).

---

## Envio do relatório por email (opcional)

Sem configuração, o botão **Enviar por email** descarrega o Excel e abre o programa de email com o resumo, para anexares o ficheiro. Para o envio ser automático, com o Excel em anexo:

1. Cria uma conta gratuita em [resend.com](https://resend.com) e verifica o teu domínio.
2. No Netlify, adiciona as variáveis:

| Variável | Exemplo |
|---|---|
| `RESEND_API_KEY` | `re_xxxxxxxx` |
| `REPORT_FROM` | `LeadRadar <relatorios@o-teu-dominio.pt>` |
| `REPORT_ALLOWED_TO` (opcional) | `eu@gmail.com,socio@gmail.com` — só estes emails podem receber |

3. **Trigger deploy**.

---

## Como funciona por dentro

- 100% estático (HTML, CSS e JavaScript), sem build. As bibliotecas (Leaflet, jsPDF, SheetJS) estão em `public/assets/vendor`, não dependem de CDNs.
- Os negócios vêm do **OpenStreetMap** através da Overpass API. A pesquisa pede negócios com nome, **sem** `website`/`url` (ou com um `website` que é só rede social ou `business.site`), e **com** pelo menos um telefone, WhatsApp ou Instagram. Exclui cadeias (tag `brand`) e entidades públicas (Juntas, Centros de Saúde, escolas, etc.).
- Telemóveis portugueses (91, 92, 93, 96) recebem botão de WhatsApp; fixos recebem botão de ligar.
- Se um servidor Overpass estiver ocupado, a ferramenta tenta automaticamente outro (lista em `config.js`).
- O pipeline, as definições e os resultados ficam guardados **no browser de cada utilizador** (localStorage e IndexedDB). Em **Definições → Exportar cópia do pipeline** dá para passar tudo para outro computador.
- Vários separadores abertos ficam sincronizados em tempo real.
- Desempenho: os marcadores do mapa são reaproveitados entre filtros (só entram/saem os que mudam), o texto de pesquisa de cada negócio é preparado uma vez, a ordenação usa `Intl.Collator` e os módulos JS são pré-carregados em paralelo (`modulepreload`).

### Estrutura

```
netlify.toml                         configuração do Netlify (raiz do repositório)
leadradar/
  public/                            o site
    index.html
    assets/css/app.css
    assets/js/config.js              ← marca, mensagens e valores por omissão
    assets/js/data.js                distritos, concelhos e categorias
    assets/js/overpass.js            consulta ao OpenStreetMap
    assets/js/leads.js               telefones, Instagram, pontuação
    assets/js/report.js              PDF, Excel, CSV, email
    assets/js/app.js                 interface
  netlify/functions/send-report.mjs  envio de email (Resend)
  netlify/edge-functions/auth.js     proteção por palavra-passe
```

### Testar no teu computador

```bash
cd leadradar/public
python3 -m http.server 8080
# abre http://localhost:8080
```

---

## Boas práticas e limites

- **Confirma antes de contactar.** Alguns negócios têm site que ainda não foi registado no OpenStreetMap. O botão **Verificar** pesquisa no Google em um clique.
- **RGPD.** São contactos de empresas tornados públicos, mas identifica-te sempre, sê breve e respeita quem disser que não quer ser contactado.
- **Cobertura.** O OpenStreetMap é muito completo nas cidades e menos nas aldeias. Lisboa e Porto têm milhares de resultados: se aparecer o aviso de limite, escolhe um concelho.
- **Servidores públicos.** A Overpass API é gratuita e partilhada; a varredura nacional faz uma pausa entre distritos para não ser bloqueada. Em horas de muito tráfego pode demorar alguns minutos.
- **Licença dos dados.** © colaboradores do OpenStreetMap, licença ODbL. A atribuição já aparece no rodapé, no mapa e nos relatórios: mantém-na.
- **Mapa base.** O fundo do mapa usa os mosaicos gratuitos da CARTO. Para muito tráfego comercial, considera uma conta CARTO, MapTiler ou Stadia e troca o URL em `assets/js/map.js`.
