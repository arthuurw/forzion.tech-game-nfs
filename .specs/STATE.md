# Project state

Jogo de corrida de rua no browser, estilo Need for Speed Underground 2.

## Roadmap

Cada sub-projeto é uma feature própria (plan → checks → build → verify), nesta ordem:

1. `free-roam-city` - carro dirigível, cidade noturna procedural, HUD, som (concluída)
   - 1.1 `engine-sound` - motor sintetizado mais baixo e menos irritante (concluída)
   - 1.2 `visual-upgrade` - PBR CC0, chuva, neon calmo, marcas, fumaça, faíscas, câmera de velocidade, pós moderno (concluída)
   - 1.3 `city-terrain` - cidade de 3 km com morros, rio, baía, rodovia em anel, pontes e streaming por chunks (concluída)
   - 1.4 `car-handling` - mecânica do carro: não capota, aderência, direção, câmbio, freios e motor de carro real (concluída)
   - 1.5 `facade-glint` - farol não faz fachada piscar (antialiasing de especular no shader da fachada, metal e tijolo mais foscos) (concluída)
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
| AD-011 | Estende a AD-005: provas de dirigibilidade com física real em `tests/physics/*.test.ts` no vitest (node) - `RAPIER.init()`, `World` com chão plano de 8 km e rampa de 9 %, o `Car` real com assets placeholder, passo de 1/60 s em loop (door 3 da car-handling) | o SwiftShader do Playwright leva ~1 min por manobra e o mapa não tem 200 m planos livres para curva a 150 km/h; 240 passos rodam em ~74 ms | active | 2026-09-26 |

## Handoff

**Feature**: nenhuma em andamento - city-terrain, car-handling e facade-glint concluídas e juntadas em `main`
**Where**: `main` com as três features; 103/103 unitários (vitest, com `tests/physics`) e 75/75 e2e verdes em 2026-09-26
**In progress**: nada
**Next step**: usuário testa o mapa, a direção nova e as fachadas; então sub-projeto 2 (corridas) em `.specs/features/races/`, lendo o `RoadNetwork` e o `CarSpec`
**Blockers**: none
**Branch**: `main`

Concluídas: free-roam-city (PASS rodada 4), engine-sound (PASS rodada 3), visual-upgrade (PASS rodada 4), city-terrain (PASS rodada 3, escopada ao collider do pilar), car-handling (PASS rodada 4, escopada ao freio-motor da ré; a rodada 4 foi autorizada pelo usuário depois de escalar), facade-glint (PASS rodada 1).
Decisões do usuário no build (2026-09-26): C1 da facade-glint isola o especular; metal com `metalness` 0.05 e `normalScale` 0.2, tijolo com `normalScale` 0.25 e piso de rugosidade 0.6; C4 da car-handling com sinal corrigido e C29 com velocidade horizontal; freio de mão com acelerador mantém o motor (power slide); freio-motor na ré.
Resíduos conhecidos: o reflexo da rua (door 3 da visual-upgrade) ainda cintila um pouco com a câmera andando; tijolo passa o C1 da facade-glint com margem curta (0.00074 de 0.0010); o "R" da ré no HUD não tem prova no browser; o literal "23 módulos puros" do C45 da city-terrain virou 24 com o `carSpec.ts`.
