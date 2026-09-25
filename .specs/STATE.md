# Project state

Jogo de corrida de rua no browser, estilo Need for Speed Underground 2.

## Roadmap

Cada sub-projeto é uma feature própria (plan → checks → build → verify), nesta ordem:

1. `free-roam-city` - carro dirigível, cidade noturna procedural, HUD, som
2. corridas - checkpoints, cronômetro, sprint/circuito, IA oponente por waypoints
3. garagem + tuning visual - pintura, rodas, vinil, body kit, underglow
4. tuning de performance - motor, turbo, pneus alterando parâmetros do Rapier
5. carreira - progressão, dinheiro, desbloqueios, save em `localStorage`
6. extras - drift/drag como modos, tráfego, multiplayer (talvez nunca)

## Decisions

| ID | Decision | Rationale | Status | Date |
| --- | --- | --- | --- | --- |
| AD-001 | Stack: Vite + TypeScript vanilla, sem framework de UI; HUD em HTML/CSS | menos camadas para um iniciante; bundle enxuto | active | 2026-09-25 |
| AD-002 | Física: `@dimforge/rapier3d-compat` com `DynamicRayCastVehicleController`; feeling arcade vem de parâmetros, não de física própria | colisões robustas sem reescrever; escolha do usuário | active | 2026-09-25 |
| AD-003 | Render: `three` `WebGLRenderer` + `EffectComposer`/`UnrealBloomPass`/`OutputPass`; tone mapping ACES | look NFSU2 (neon + bloom) com API estável e documentada | active | 2026-09-25 |
| AD-004 | Layout: `src/{core,world,vehicle,camera,hud,audio}/`; módulos com estado expõem `update(dt)`; lógica pura em arquivos sem import de `three`/`rapier` | fronteiras testáveis com vitest; cada arquivo cabe na cabeça | active | 2026-09-25 |
| AD-005 | Provas: vitest para módulos puros; Playwright chromium para integração lendo `window.__game`, exposto só em `import.meta.env.DEV` | verificação com exit code; nada de estado interno em produção | active | 2026-09-25 |
| AD-006 | Física em passo fixo 1/60 s por acumulador, máximo 5 passos por frame | simulação independente do FPS; testes reproduzíveis | active | 2026-09-25 |
| AD-007 | Unidades: metros, segundos, Y para cima, velocidade interna em m/s (exibida × 3.6), heading em rad com 0 = `+Z`; frente do carro = `+Z` local | uma convenção para todo cálculo; segue glTF | active | 2026-09-25 |
| AD-008 | Geração procedural determinística por `seed` com PRNG `mulberry32`; nunca `Math.random` em lógica de mundo | layouts reproduzíveis e testáveis | active | 2026-09-25 |
| AD-009 | Assets 3D só CC0 (Kenney) em `public/models/`; sempre com fallback procedural quando o arquivo falta | zero atribuição obrigatória; jogo nunca quebra por asset ausente | active | 2026-09-25 |

## Handoff

**Feature**: free-roam-city - CONCLUÍDA (Verifier rodada 3: PASS, 46/46 checks, 15/15 mutantes mortos, gate exit 0)
**Where**: tudo commitado em `main`; `verification.md` é o relatório final; usuário testando no browser
**In progress**: nenhum
**Next step**: coletar feedback de jogabilidade (feeling do carro, FPS, visual, som) e ajustar parâmetros; depois sub-projeto 2 (corridas) em `.specs/features/races/`
**Blockers**: none
**Uncommitted**: nenhum
**Branch**: main

Achados residuais menores (não bloqueiam): C46 afirma a ordem do grafo pela ordem dos campos de `graph()`, e `masterConnected` não detecta `master` desconectado do destino; C42 mata o mutante "sem rotate" por 1 px; `InputManager` ignora `event.repeat` sem prova própria.
