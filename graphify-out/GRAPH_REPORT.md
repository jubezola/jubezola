# Graph Report - jubezola  (2026-11-19)

## Corpus Check
- 21 files · ~34,880 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 6 file(s) not represented in the graph (top: .css 3, (none) 1, .webmanifest 1)

## Summary
- 844 nodes · 2848 edges · 34 communities (30 shown, 4 thin omitted)
- Extraction: 85% EXTRACTED · 15% INFERRED · 0% AMBIGUOUS · INFERRED: 434 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `049b0a69`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- Oa
- r
- Se
- make_xlsx_lib
- report.js
- I
- Do
- app.js
- store.js
- ho
- leaflet.js
- init
- jspdf.plugin.autotable.min.js
- ao
- map.js
- scanAll
- fl
- hl
- LeadRadar Portugal
- m
- F
- bindReport
- handleSendReport
- Jt
- e
- bindSearch
- p
- vercel.json
- zi
- Je
- middleware.js
- auth.js

## God Nodes (most connected - your core abstractions)
1. `make_xlsx_lib()` - 244 edges
2. `Oa()` - 103 edges
3. `r()` - 81 edges
4. `Se` - 55 edges
5. `I()` - 49 edges
6. `o()` - 48 edges
7. `E()` - 44 edges
8. `A()` - 38 edges
9. `c()` - 36 edges
10. `ho()` - 35 edges

## Surprising Connections (you probably didn't know these)
- `r()` --indirect_call--> `Ce()`  [INFERRED]
  leadradar/public/assets/vendor/jspdf.umd.min.js → leadradar/public/assets/vendor/leaflet/leaflet.js
- `ni()` --indirect_call--> `ai()`  [INFERRED]
  leadradar/public/assets/vendor/xlsx.mini.min.js → leadradar/public/assets/vendor/leaflet/leaflet.js
- `ji()` --indirect_call--> `Ui()`  [INFERRED]
  leadradar/public/assets/vendor/xlsx.mini.min.js → leadradar/public/assets/vendor/leaflet/leaflet.js
- `POST()` --calls--> `handleSendReport()`  [EXTRACTED]
  api/send-report.mjs → leadradar/server/send-report-core.mjs
- `GET()` --calls--> `handleSendReport()`  [EXTRACTED]
  api/send-report.mjs → leadradar/server/send-report-core.mjs

## Import Cycles
- None detected.

## Communities (34 total, 4 thin omitted)

### Community 0 - "Oa"
Cohesion: 0.08
Nodes (101): Oa(), a(), ae(), an(), at(), b(), be(), bn() (+93 more)

### Community 1 - "r"
Cohesion: 0.05
Nodes (58): a(), _a(), aa(), b(), C(), Ca(), d(), Dt() (+50 more)

### Community 2 - "Se"
Cohesion: 0.05
Nodes (7): ea(), fa, ha(), Se, ua(), Vi(), xe()

### Community 3 - "make_xlsx_lib"
Cohesion: 0.05
Nodes (64): make_xlsx_lib(), Ai(), al(), as(), bi(), bs(), cc(), ci() (+56 more)

### Community 4 - "report.js"
Cohesion: 0.07
Nodes (51): CONFIG, PIPELINE_STAGES, TEMPLATES, CATEGORIES, categorize(), CATEGORY_BY_ID, DISTRICT_BY_ID, DISTRICTS (+43 more)

### Community 5 - "I"
Cohesion: 0.19
Nodes (57): A(), aa(), ae(), b(), Be(), br(), c(), ce() (+49 more)

### Community 6 - "Do"
Cohesion: 0.12
Nodes (39): at(), bn(), bt(), cl(), Dn(), Do(), Fi(), Fn() (+31 more)

### Community 7 - "app.js"
Cohesion: 0.12
Nodes (36): applyEntry(), collator, daysAgo(), enrich(), enrichCopy(), esc(), eur(), feedItems (+28 more)

### Community 8 - "store.js"
Cohesion: 0.11
Nodes (29): allCachedLeads(), loadFilters(), loadStatsFromCache(), block(), blocked, blockedPhones, broadcast(), cacheAll() (+21 more)

### Community 9 - "ho"
Cohesion: 0.18
Nodes (27): cs(), Ea(), el(), es(), fa(), fc(), h(), ho() (+19 more)

### Community 10 - "leaflet.js"
Cohesion: 0.08
Nodes (7): a(), ai(), Ce(), Ci(), l(), Ui(), x()

### Community 11 - "init"
Cohesion: 0.23
Nodes (25): bindLeadDialog(), bindPipeline(), bindSettings(), copyText(), feed(), handleLeadAction(), igTemplate(), init() (+17 more)

### Community 12 - "jspdf.plugin.autotable.min.js"
Cohesion: 0.22
Nodes (17): c(), d(), e(), f(), g(), h(), i(), l() (+9 more)

### Community 13 - "ao"
Cohesion: 0.19
Nodes (19): jr(), ao(), ar(), Bl(), co(), Cr(), Dr(), En() (+11 more)

### Community 14 - "map.js"
Cohesion: 0.17
Nodes (16): buildTiles(), reduceMotion(), selectDistrict(), setupMap(), dark(), focusDistrict(), iconFor(), icons (+8 more)

### Community 15 - "scanAll"
Cohesion: 0.26
Nodes (16): fetchAndStore(), hhmm(), keyFor(), n(), render(), renderCats(), renderCities(), runSearch() (+8 more)

### Community 16 - "fl"
Cohesion: 0.18
Nodes (16): bo(), ec(), Eo(), fl(), Fs(), Go(), gr(), jo() (+8 more)

### Community 17 - "hl"
Cohesion: 0.19
Nodes (15): ba(), ca(), dl(), ga(), hl(), ic(), ka(), lc() (+7 more)

### Community 18 - "LeadRadar Portugal"
Cohesion: 0.14
Nodes (13): Boas práticas e limites, Como funciona por dentro, Envio do relatório por email (opcional), Estrutura, LeadRadar Portugal, Mudar o nome e a marca, Opção A: a partir do GitHub (recomendada), Opção B: arrastar a pasta (+5 more)

### Community 19 - "m"
Cohesion: 0.21
Nodes (12): at(), be(), d(), ht(), Li(), m(), v(), ve() (+4 more)

### Community 20 - "F"
Cohesion: 0.24
Nodes (11): F(), G(), h(), j(), k(), ke(), me(), Oe() (+3 more)

### Community 21 - "bindReport"
Cohesion: 0.31
Nodes (10): bindReport(), cmp(), currentReport(), filtered(), openReport(), passesBase(), updateReportPreview(), withBusy() (+2 more)

### Community 22 - "handleSendReport"
Cohesion: 0.42
Nodes (6): env(), GET(), POST(), config, handleSendReport(), json()

### Community 23 - "Jt"
Cohesion: 0.22
Nodes (9): Ae(), Ie(), Jt(), Le(), O(), Qt(), Re(), $t() (+1 more)

### Community 24 - "e"
Cohesion: 0.22
Nodes (9): bi(), c(), e(), hi(), Pi(), q(), Qe(), Ti() (+1 more)

### Community 25 - "bindSearch"
Cohesion: 0.32
Nodes (8): bindSearch(), clearFilters(), saveFilters(), setMobileMode(), setView(), syncFilterControls(), invalidate(), setUi()

### Community 26 - "p"
Cohesion: 0.33
Nodes (7): De(), ei(), ii(), p(), pe(), ri(), ti()

### Community 27 - "vercel.json"
Cohesion: 0.29
Nodes (6): buildCommand, framework, headers, installCommand, outputDirectory, $schema

### Community 28 - "zi"
Cohesion: 0.50
Nodes (5): i(), Mi(), ne(), e(), zi()

### Community 29 - "Je"
Cohesion: 0.67
Nodes (4): Je(), ni(), oi(), si()

## Knowledge Gaps
- **4 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `make_xlsx_lib()` connect `make_xlsx_lib` to `Oa`, `I`, `Do`, `ho`, `ao`, `fl`, `hl`, `p`?**
  _High betweenness centrality (0.198) - this node is a cross-community bridge._
- **Are the 36 inferred relationships involving `make_xlsx_lib()` (e.g. with `aa()` and `bc()`) actually correct?**
  _`make_xlsx_lib()` has 36 INFERRED edges - model-reasoned connections that need verification._
- **Should `Oa` be split into smaller, more focused modules?**
  _Cohesion score 0.07862550960978451 - nodes in this community are weakly interconnected._
- **Why does `r()` connect `r` to `Oa`, `Se`, `I`, `ho`, `leaflet.js`, `m`, `F`, `Jt`, `Je`?**
  _High betweenness centrality (0.189) - this node is a cross-community bridge._
- **Are the 11 inferred relationships involving `Oa()` (e.g. with `an()` and `dt()`) actually correct?**
  _`Oa()` has 11 INFERRED edges - model-reasoned connections that need verification._
- **Should `r` be split into smaller, more focused modules?**
  _Cohesion score 0.050616050616050616 - nodes in this community are weakly interconnected._
- **Why does `Se` connect `Se` to `r`?**
  _High betweenness centrality (0.086) - this node is a cross-community bridge._