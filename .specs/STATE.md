# Project state

Jogo de corrida de rua no browser, estilo Need for Speed Underground 2.

## Roadmap

Cada sub-projeto é uma feature própria (plan → checks → build → verify), nesta ordem:

1. `free-roam-city` - carro dirigível, cidade noturna procedural, HUD, som (concluída)
   - 1.1 `engine-sound` - motor sintetizado mais baixo e menos irritante (concluída)
   - 1.2 `visual-upgrade` - PBR CC0, chuva, neon calmo, marcas, fumaça, faíscas, câmera de velocidade, pós moderno (concluída)
   - 1.3 `city-terrain` - cidade de 3 km com morros, rio, baía, rodovia em anel, pontes e streaming por chunks (verificação round 1 FAIL por lacunas de teste; corrigindo)
   - 1.4 `car-handling` - mecânica do carro: não capota, aderência, direção, câmbio, freios e motor de carro real (em plano)
   - 1.5 `facade-glint` - farol não faz fachada piscar (antialiasing de especular no shader da fachada) (checks escritos, aguardando ok)
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
| AD-010 | Mundo da city-terrain: terreno por heightfield 769 × 769 a cada 4 m, estradas como polilinhas 3D a cada 2 m (`RoadNetwork`, door 2), prédios por lote ao longo das ruas; física toda no boot, malhas por chunks de 512 m | mapa grande e orgânico sem perder a colisão; o formato das estradas será lido pelas corridas | active | 2026-09-25 |

## Handoff

**Feature**: city-terrain - build em andamento no worktree `../Jogo-terrain` (branch `city-terrain`)
**Where**: tudo commitado no branch `city-terrain` e juntado em `main`; 68/68 e2e e 74/74 unitários verdes
**In progress**: Verifier da city-terrain sobre o merge
**Next step**: depois do PASS, usuário testa o mapa novo; então sub-projeto 2 (corridas) em `.specs/features/races/`, lendo o `RoadNetwork`
**Blockers**: none
**Branch**: city-terrain (worktree); `main` com visual-upgrade (rodada 4 PASS) e free-roam-city (rodada 4 PASS)

Concluídas: free-roam-city (PASS rodada 4, escopada ao espaçamento de 40 m dos postes), engine-sound (PASS rodada 3), visual-upgrade (PASS rodada 4, escopada à cintilação das janelas).
Resíduos conhecidos: o reflexo da rua (door 3 da visual-upgrade, render target a meia viewport) ainda cintila um pouco com a câmera andando; mudar exige reabrir a door 3.
