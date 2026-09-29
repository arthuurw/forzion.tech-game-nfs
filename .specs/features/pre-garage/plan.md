# pre-garage

## Problem

O sub-projeto 3 (garagem e tuning visual) precisa trocar e repintar o carro do jogador, pôr peça visual nova e, depois, voltar ao menu. A validação de 2026-09-29 (`.specs/audits/2026-09-29-validation.md`) mostrou que o código de hoje barra cada uma dessas coisas:

- **Orçamento de draw calls esgotado.** São 219 de 220 no grid da corrida no centro (`STATE.md`; `race.spec.ts:338`, `render.spec.ts:53`). Qualquer peça por carro estoura o teste. O miolo gasta 14 draw calls fixas; várias malhas têm esfera de culling do tamanho do mundo ou `frustumCulled = false` (miolo-4, docs-9).
- **Carro fixo:**
  - o jogador é `readonly car` construído uma vez com `DEFAULT_CAR` (`Game.ts:94,177`);
  - faróis e cones são presos ao mesh dentro do `Game`, em posições fixas (CORE-4);
  - o modelo glTF é usado sem clonar, de modo que um segundo `Car` sem pintura rouba o Object3D, e o jogador não aceita pintura (docs-8, `Car.ts:512`);
  - o conta-giros e o áudio usam `RPM_MIN`/`RPM_MAX` do `DEFAULT_CAR`. Um carro com outra rotação máxima passa de 100 % na barra (veh-6);
  - o número de corredores está escrito à mão em três lugares acoplados (veh-9).
- **Game.ts ilegível.** São 1756 linhas, e ~1370 delas são sondas de teste que vão para o bundle de produção. `debugHandle()` roda também em produção e copia dados do mundo no boot (CORE-3, docs-10, CORE-6). A AD-004 promete que cada arquivo cabe na cabeça.
- **Sem saída do jogo.** Não há `dispose` no `Game`, no `InteriorScene`, no `TrainScene` nem no `AudioEngine`. Recriar o jogo duplica os handlers de teclado, vaza o mundo WASM do Rapier e deixa dois `AudioContext` tocando (CORE-5, miolo-5).
- **Bundle único.** O build sai num chunk de 5.24 MB com o WASM do Rapier em base64, e o aviso de tamanho aparece sempre (gates-2).
- **Deriva silenciosa no miolo:**
  - a direção do vapor na tela não vem da função que o teste prova (miolo-9);
  - a densidade da névoa está copiada como literal no shader do vagalume, o vapor não tem névoa, e `uFlood[12]` é literal enquanto o laço usa `MAX_FLOODS` (miolo-10).

Quando isto sair: sobram 15 draw calls para a garagem, o carro do jogador pode ser trocado e repintado em tempo de execução, o `Game` volta a caber na cabeça sem levar sonda para produção, o jogo inteiro pode ser desmontado e montado de novo, e o bundle separa as bibliotecas.

## Flow

Reusa o caminho de modelo do oponente (`buildOpponentModel`: carroceria numa malha com o shader de pintura, rodas instanciadas, 2 draw calls) para o jogador, e o `exposeDebug` (AD-005) como único ponto de exposição.

1. `main.ts` (exists): só em `import.meta.env.DEV` carrega por `import()` o módulo de debug e chama `exposeDebug` (door 1).
2. `core/debug` (door 1): `debugHandle` e as sondas saem do `Game` para cá e leem o jogo por campos públicos de leitura.
3. `core/Game` (exists): fica com montagem, loop, input e render. Ganha `setPlayerCar(spec, paint)` (door 3) e `dispose()`. Farol e cones passam a vir de `src/vehicle/`, montados pelo tamanho do modelo.
4. `vehicle/Car` (exists): sempre clona o modelo, o jogador usa o mesmo caminho de 2 draw calls do oponente, e ganha `setPaint(hex | null)` (door 3).
5. `vehicle/drivetrain`, `hud/format`, `audio/audioMap` (exists): idle e redline vêm da `CarSpec` do carro em uso.
6. `race/RaceController` e `race/raceProgress` (exists): número de corredores e nomes derivados do grid.
7. `world/interiors/InteriorScene`, `world/rail/TrainScene`, `world/CityScene`, `audio/AudioEngine`, `core/InputManager` (exists): `dispose()` em cada um, chamado pelo `Game.dispose()`.
8. `world/interiors/InteriorScene` (exists): malhas do mesmo material juntas, culling com o volume real, ângulo do vapor e névoa de uma fonte só. O orçamento vira regra por AD (door 2).
9. `vite.config.ts` (exists): chunks separados para `three` e para o Rapier, e limite de aviso medido.

## Impact

| Front | What changes |
| --- | --- |
| decisões | a AD-005 ganha a regra de que código de sonda só entra no bundle de DEV, por uma AD nova que a estende (door 1) |
| decisões | AD nova do orçamento de draw calls (door 2) e AD nova do carro trocável e da pintura (door 3) |
| sondas DEV | `window.__game` mantém as mesmas chaves e os mesmos valores. Todas as provas e2e existentes seguem sem mudar de seletor |
| checks de outras features | races C19/C32 e block-life-extras door 3 (pintura dos oponentes) continuam; o jogador passa a usar o mesmo shader com a cor laranja original quando não tem pintura |
| checks de outras features | free-roam-city AC 12 (cones de farol) continua; os cones passam a nascer fora do `Game` |
| checks de outras features | orçamento: `race.spec.ts:338` e `render.spec.ts:53` passam de ≤ 220 para ≤ 205 |
| termo | `RPM_MIN`/`RPM_MAX` deixam de existir. Quem usa hoje: `hud/format.ts:14`, `audio/audioMap.ts:37,53` e os testes deles |
| build | `dist/assets` passa de 1 para 3 ou mais arquivos JS. O `index.html` de produção carrega os chunks por `modulepreload` |
| stored data | nada para migrar |

## Relations

None - no stored-data shape change

## Surface

None - nothing consumed outside

## Landing

| One-way door | Literal shape | Alternative rejected |
| --- | --- | --- |
| 1. Sondas só no bundle de DEV (padrão que toda sonda nova copia) | pasta `src/core/debug/`; `main.ts` faz `if (import.meta.env.DEV) { const { debugHandle } = await import('./core/debug'); exposeDebug(import.meta.env, debugHandle(game), window); }`. Sonda nova vai nessa pasta, nunca em classe de jogo. AD nova estendendo a AD-005 | manter as sondas como métodos do `Game` atrás de um `if (DEV)`: o bundler não remove métodos de classe, e o arquivo continua com 1756 linhas |
| 2. Orçamento de draw calls com reserva | teto 220 no grid da corrida e em todo ponto de `render.spec.ts`; o jogo base fica em ≤ 205, e as 15 restantes são reservadas para a garagem e o tuning. Todo plan que soma draw calls declara quantas. AD nova | subir o teto: recusado pelo usuário em 2026-09-29 ("Cortar custo, manter 220") |
| 3. Carro do jogador trocável e pintura por uniforme (contrato que a garagem vai chamar) | `Game.setPlayerCar(spec: CarSpec, paint: string \| null): Car` desmonta o carro antigo, monta o novo na mesma pose e reaplica faróis, câmera, corrida e HUD. `Car.setPaint(hex: string \| null)` troca o laranja do atlas pela cor no shader (`null` = laranja original). AD nova | recriar o `Game` inteiro a cada troca: refaz o mundo e a física em segundos; pintura por material por peça: custa uma draw call por peça, contra a door 2 |

- Nothing else in this change is hard to reverse

## Criteria

### S1: sobra de draw calls sem mudar a imagem (P1)

**Acceptance Criteria**

1. WHILE a corrida está no grid do centro com os 4 carros, the system SHALL fazer ≤ 205 draw calls por quadro.
2. The system SHALL fazer ≤ 205 draw calls em todas as poses de câmera de `render.spec.ts`.
3. The system SHALL desenhar o carro do jogador com 2 draw calls por passe, como o oponente.
4. The system SHALL dar a cada malha do miolo e do trem um volume de culling que cobre só o que ela desenha. Nenhuma malha SHALL ter `frustumCulled = false` com um volume maior que o raio de atividade dela.
5. WHEN as provas de pixel existentes do miolo, do trem e da pintura rodam THEN SHALL passar sem mudar limites.

**Independent test:** `npx playwright test tests/e2e/race.spec.ts -g "draw calls"` e `tests/e2e/render.spec.ts`.

### S2: carro trocável e repintável (P1)

**Acceptance Criteria**

6. WHEN `Game.setPlayerCar(spec, paint)` roda THEN the system SHALL desmontar o carro antigo (o número de corpos rígidos no mundo Rapier fica igual ao de antes da troca), pôr o novo na mesma posição e heading, e reaplicar os 2 faróis e os 2 cones ao carro novo.
7. WHEN o carro é trocado THEN a câmera, a corrida, o HUD e o áudio SHALL passar a ler o carro novo no quadro seguinte.
8. The system SHALL clonar o modelo glTF para cada `Car`. Depois de criar 2 carros sem pintura, `assets.carModel.parent` SHALL ser `null`.
9. WHEN `car.setPaint('#2060ff')` roda THEN a média dos pixels da carroceria do jogador na tela SHALL ter azul maior que vermelho. WHEN `setPaint(null)` roda THEN SHALL voltar a ter vermelho maior que azul (laranja original).
10. WHILE o jogador não tem pintura, the system SHALL desenhar o carro dele com a média de cor da carroceria a ≤ 3/255 da medida antes desta feature, na mesma pose.
11. WHEN o carro em uso tem `idleRpm` e `redlineRpm` próprios THEN a barra de RPM SHALL mostrar 0 % no idle e 100 % no redline dele, e o mapa de áudio SHALL chegar a 1 no redline dele. Testado com idle 1000 e redline 8500.
12. WHEN uma corrida tem N lugares no grid (testado com 3 e 5) THEN the system SHALL criar N − 1 oponentes, mostrar `POS k/N` e pôr nome no resultado pelo id do corredor.

**Independent test:** hook DEV `setPlayerCar` numa página e leitura de `__game` e dos pixels.

### S3: Game que cabe na cabeça, sem sonda em produção (P1)

**Acceptance Criteria**

13. The system SHALL ter `src/core/Game.ts` com no máximo 500 linhas, e nenhuma sonda (`probe*`, `*Debug`) nele.
14. WHEN `npm run build` roda THEN nenhum arquivo de `dist/assets` SHALL conter `probeRoadMarks`, `probeHeadlightShimmer`, `searchlightFrameDiff` ou `facadeSpans`.
15. WHEN o jogo roda em DEV THEN `window.__game` SHALL ter as mesmas chaves de hoje, e a suíte e2e completa SHALL passar sem mudar nenhum seletor de `__game`.
16. WHEN o jogo roda em produção THEN the system SHALL não chamar nenhuma função do módulo de debug.

**Independent test:** `npm run build && grep -l probeRoadMarks dist/assets/*.js` sem resultado.

### S4: desmontar e montar de novo (P2)

**Acceptance Criteria**

17. WHEN `Game.dispose()` roda THEN the system SHALL parar o loop (`__game.frames` não muda em 0.5 s), remover os listeners de `resize`, `keydown`, `keyup`, `blur` e `visibilitychange` que o jogo pôs, fechar o `AudioContext` (`state === 'closed'`) e liberar o mundo Rapier e a fila de eventos.
18. WHEN `Game.dispose()` roda THEN the system SHALL deixar `renderer.info.memory.geometries` e `renderer.info.memory.textures` em 0, liberando as malhas, os materiais e as texturas do mundo, do miolo, do trem, do carro e do pós-processamento.
19. WHEN um `Game` novo é criado na mesma página depois do `dispose` THEN the system SHALL chegar ao primeiro quadro, e WHEN o jogador aperta W uma vez THEN um único carro SHALL acelerar e só um `AudioContext` SHALL estar `running`.

**Independent test:** hook DEV que chama `dispose` e cria outro `Game` no mesmo canvas.

### S5: bundle separado (P3)

**Acceptance Criteria**

20. WHEN `npm run build` roda THEN the system SHALL emitir `three` e o Rapier em chunks JS separados do código do jogo, e SHALL não imprimir o aviso de chunk grande, com `chunkSizeWarningLimit` = maior chunk medido + 10 %.
21. WHEN o build de produção é servido por `vite preview` THEN the system SHALL chegar ao primeiro quadro (`#loading` escondido, `#hud` visível) sem erro no console.

**Independent test:** `npm run build`, `npx vite preview --port 5198` e um Playwright de uma página só.

### S6: miolo sem deriva (P3)

**Acceptance Criteria**

22. The system SHALL tirar o ângulo e a fase de cada fio de vapor da mesma função pura que `steamPoint` usa. O atributo `aAngle` da malha SHALL ser igual, elemento a elemento, ao que a função devolve.
23. The system SHALL ler a densidade da névoa de uma única constante, a do `FogExp2` da cena, nos shaders do vagalume e do vapor. O vapor SHALL escurecer com a distância como o resto da cena.
24. The system SHALL declarar o array `uFlood` com o tamanho `MAX_FLOODS` interpolado, sem o literal `12`.

**Independent test:** teste unitário que lê os atributos montados e o texto dos shaders.

## Out of scope

| Excluded | Why |
| --- | --- |
| máquina de estados de tela (menu, garagem, rua, corrida) e atalhos por modo (CORE-3) | o sub-projeto 3 cria as telas. Desenhar a máquina antes das telas é adivinhar. Fica como pré-condição do plano da garagem |
| validar a `CarSpec` (veh-7) | as faixas dos controles de tuning são do sub-projeto 4 |
| WorldBuilder e PostPipeline como classes | é posicionamento. O AC 13 fixa o resultado (≤ 500 linhas), e onde o código mora fica no diff |
| trocar de seed ou de cidade em tempo de execução | o S4 deixa possível, mas nenhuma feature pede hoje |

## Assumptions

| Assumption | Chosen default | Rationale | Confirmed? |
| --- | --- | --- | --- |
| como abrir espaço no orçamento | cortar custo e manter o teto 220 | decisão do usuário em 2026-09-29 | y |
| alvo do jogo base | ≤ 205 (15 de reserva) | jogador em 2 draw calls por passe e 2-4 malhas do miolo juntas cobrem a conta. IF o build não chega a 205 sem mudar a imagem THEN para e pergunta, sem afrouxar | n |
| tamanho máximo do Game.ts | 500 linhas | as ~387 linhas que não são sonda, menos farol e cones, com folga para `setPlayerCar` e `dispose` | n |
| tolerância da cor do jogador sem pintura | ≤ 3/255 na média da carroceria | o shader de pintura com a cor original reproduz o atlas; a diferença que sobra é de arredondamento | n |
| como o debug lê o jogo | campos públicos `readonly` no `Game` e nas cenas | o módulo de debug não pode acessar `private`; campos de leitura não abrem escrita | n |

**Open questions:** none - all resolved or logged above.

## Observable

| Surface | Decision | Landing |
| --- | --- | --- |
| tela de jogo (carro do jogador) | estado sem pintura | AC 10 |
| tela de jogo (carro do jogador) | troca de carro | AC 6, AC 7 |
| HUD barra de RPM | densidade e limites | AC 11 |
| HUD posição e tela de resultado | ordenação e contagem | AC 12 |
| tela de jogo | carregamento e erro no build de produção | AC 21 |
| tela de jogo | ação destrutiva confirma | n/a - `dispose` e `setPlayerCar` são chamados por código; a garagem decide a confirmação no plano dela |
| tela de jogo | não autorizado | n/a - jogo local, sem conta |

## Sources

- `.specs/audits/2026-09-29-validation.md` - achados miolo-4, miolo-5, miolo-9, miolo-10, docs-8, docs-9, docs-10, CORE-3, CORE-4, CORE-5, CORE-6, veh-6, veh-9, gates-2
- decisão do usuário em 2026-09-29: cortar custo e manter o teto de 220 draw calls
