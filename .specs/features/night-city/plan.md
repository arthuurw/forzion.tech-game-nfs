# night-city

## Problem

A cidade à noite tem defeitos que se veem no primeiro segundo de jogo (`docs/screenshots/01-centro-acelerando.jpg`, `02-curva.jpg`):

- **Luz flutuando.** A lâmpada do poste é uma caixa emissiva de 0.5 × 0.2 × 0.5 m, sem braço nem luminária (`CityScene.ts:257`), com brilho 2.5 contra o limiar de bloom de 0.7 (`Game.ts:262`). O halo engole o poste escuro de 8-10 cm, e o que se vê é um quadrado branco solto no ar. Nada no chão recebe essa luz: não existe luz real por poste (`Environment.ts:53`).
- **Confete no asfalto.**
  - O espelho da rua é um `Reflector` plano, nítido, com blur fixo de 2.5 texels que não cresce com a distância (`CityScene.ts:42-85`).
  - O blend `overlay` do three deixa o reflexo mais forte que a fonte: uma lâmpada de brilho 2.5 vira ~3.25 no asfalto e passa do limiar do bloom.
  - As placas de neon são planos sem espessura (`CityScene.ts:273-303`), então refletidas de lado viram losangos.
  - O resultado são formas brilhantes e nítidas espalhadas pela pista, sem ligação com nada.
- **Céu preto.** O fundo é a cor `#05060d` e a névoa tem a mesma cor (`Environment.ts:48-49`). Não há horizonte nem brilho de cidade: os prédios distantes somem no preto, não no ar.
- **Tudo igual.** Todas as luzes de rua têm a mesma cor e todas as janelas acesas o mesmo tom quente (`CityScene.ts:34`). Não dá para saber, pela luz, se o carro está no centro ou num bairro.

O usuário pediu melhorias visuais em 2026-09-29, escolheu começar pela cidade e decidiu o reflexo em faixas verticais, a cor da luz por bairro e o céu com brilho e silhueta. As outras decisões foram delegadas ("siga até o fim com recomendadas").

Quando isto sair:
- o poste tem braço e luminária, e ilumina o chão embaixo;
- o asfalto molhado mostra a luz escorrendo em faixas verticais, sem formas soltas;
- o céu tem horizonte com brilho da cidade e silhueta de prédios distantes;
- centro e bairros têm cores de luz diferentes, e os letreiros parecem letreiros.

Nada disso pisca: o único movimento de luz continua sendo o respiro lento do neon, que já existe.

## Flow

Reusa o `Reflector` e o alvo de meia resolução de hoje (door 3 da visual-upgrade intacta), o padrão de constante TS interpolada no GLSL da residuals (`BULB_AMPLITUDE`, `FIREFLY_DRIFT`), as sondas DEV de pixel de `Game.ts` (`render.shimmer`, `render.mirrorGain`) e o `mulberry32` para tudo o que é sorteado.

1. `world/roads/roadMesh` (exists): `generateLamps` passa a guardar o heading da estrada em cada poste. A cor de cada poste sai de uma regra pura por bairro (door 1).
2. `world/lampLight` (door 2): função pura que monta, a partir dos postes, a grade de luz no chão (cor e intensidade por célula de 2 m).
3. `world/CityScene` (exists): os postes viram uma malha só (poste, braço, carcaça e lente emissiva), com a cor por instância. Os materiais do chão (asfalto, calçada, terreno) leem a grade de luz. Os letreiros ganham espessura e tubos desenhados no shader. As janelas acesas ganham cor fixa por janela. O shader do espelho faz as faixas verticais.
4. `world/Environment` (exists): céu em cúpula que acompanha a câmera, com degradê, brilho no horizonte e silhueta de prédios. A névoa ganha a cor do horizonte (door 3).
5. `core/Game` (exists): a cúpula sai do espelho (`reflectorSkipList`), e o render a posiciona na câmera. Ganha as sondas DEV novas de pixel e de dados.
6. `tests/unit`, `tests/e2e` (exists): provas novas; as provas de brilho, cintilação, espelho e orçamento das features anteriores continuam valendo.

## Impact

| Front | What changes |
| --- | --- |
| visual | poste mais alto que a caixa de hoje ao olhar, com braço de 1.6 m sobre a rua; a lâmpada fica na luminária, virada para baixo |
| visual | reflexo da rua: some a nitidez; as luzes viram faixas verticais que se alongam com a distância; o reflexo nunca brilha mais que a fonte |
| visual | céu e névoa deixam de ser `#05060d`; os prédios distantes somem numa névoa roxa-azulada |
| checks de outras features | visual-upgrade C4 (alvo do espelho em meia resolução) e door 3: mantidos |
| checks de outras features | residuals C1-C4 (cintilação do espelho ≤ 0.001 acima do sem espelho, sensibilidade ≥ 0.003 sem blur, alvo 320 × 180, ganho do espelho ≥ 0.6 × o nítido): mantidos com os mesmos limites. O "blur" deles passa a ser a faixa vertical, e `mirrorBlur: false` continua sendo a amostra única |
| checks de outras features | free-roam-city e visual-upgrade: brilho emissivo de janelas, lâmpadas e letreiros ≥ 2 e 4 materiais de letreiro com respiro em [2.0, 3.2] (`render.spec.ts:58-65`, `visual.spec.ts:134-145`): mantidos |
| checks de outras features | city-terrain C25 (`world.spec.ts:214`, "lamp posts are two instanced meshes": 1 malha de hastes e 1 de cabeças) passa a exigir 1 `InstancedMesh` só, com `count` = número de postes. É a economia de draw call do AC 5; decisão delegada pelo usuário em 2026-09-29 |
| checks de outras features | orçamento de draw calls ≤ 220 (`render.spec.ts:12-55`, `race.spec.ts:334-339`): mantido; o grid da corrida cai de 219 para ≤ 218 |
| checks de outras features | facade-glint C1-C3 e a janela estável com a câmera andando: mantidos |
| checks de outras features | as sondas `lampEmissiveIntensity` e `windowEmissiveIntensity` continuam lendo o `emissiveIntensity` do material |
| dado do mundo | `Lamp` ganha o campo `heading` (rad, AD-007). Quem lê `Lamp`: `CityScene.buildLamps`, as sondas DEV de `Game.ts` e `tests/unit/roads.test.ts`; os postes não têm collider |
| stored data | nada para migrar |

## Relations

None - no stored-data shape change

## Surface

None - nothing consumed outside

## Landing

| One-way door | Literal shape | Alternative rejected |
| --- | --- | --- |
| 1. Cor da luz de rua por bairro (regra que garagem, corridas e carreira vão herdar) | `lampColor(lamp, road)`: `LAMP_LED = '#dce6ff'` quando o poste está no quadrado do centro (`|x|, |z| ≤ DOWNTOWN_HALF`) ou numa estrada `avenue` ou `highway` (o anel); `LAMP_SODIUM = '#ff9d4a'` em todo o resto (`hill` e `street` fora do centro). Pura, em `roadMesh.ts` | cor por estrada sorteada: fica colorido demais e não diz onde o carro está; um tom só: o usuário escolheu mistura por bairro |
| 2. Luz dos postes no chão como mapa de luz (padrão novo que todo material de chão vai copiar) | `buildLampLight(lamps, colors)` puro em `src/world/lampLight.ts` devolve uma grade `Uint8Array` RGBA de 1536 × 1536 (célula de 2 m sobre o mundo de ±1536 m), com a queda `max(0, 1 − (d / 9 m)²)²` de cada poste. Vira uma `DataTexture` (linear, sem mip) lida pelo asfalto, calçada e terreno por `onBeforeCompile`, pela posição xz do mundo. Zero draw call | malha de manchas instanciada: +1 draw call e sobreposição aditiva sobre o asfalto transparente do centro; luz real por poste: milhares de luzes, o forward do three não aguenta |
| 3. Céu em cúpula que segue a câmera, com névoa da cor do horizonte (a atmosfera que as próximas features vão ajustar) | `createSky()` em `Environment.ts`: esfera de raio 900 m, `side: BackSide`, `depthWrite: false`, `fog: false`, `renderOrder = -1`, `ShaderMaterial` com degradê `SKY_ZENITH = '#03040c'` → `SKY_HORIZON = '#2a1a3e'`, brilho laranja fraco `SKY_GLOW = '#5a2a1c'` na faixa do horizonte e silhueta de prédios `skylineHeight(azimute)` pura. `scene.fog = FogExp2(SKY_HORIZON, 0.0035)` e `scene.background = SKY_ZENITH`. Fora do espelho | `scene.background` com textura: o three desenha o fundo também dentro do `Reflector` (+2 draw calls); anel de silhueta separado da cúpula: +1 draw call |

- Nothing else in this change is hard to reverse. O shader do espelho, a malha dos postes, os letreiros e a cor das janelas são internos a `CityScene` e voltam num commit.

## Criteria

### S1: poste que ilumina o chão (P1)

**Acceptance Criteria**

1. The system SHALL desenhar cada poste como uma malha só: haste de 6 m, braço de 1.6 m na horizontal apontando para a estrada, e carcaça escura com a lente emissiva virada para baixo na ponta do braço. A lente fica 1.6 m mais perto da linha central da estrada que a base, ±0.05 m.
2. The system SHALL dar a cada poste a cor `LAMP_LED` (`#dce6ff`) no quadrado do centro e nas estradas `avenue` e `highway`, e `LAMP_SODIUM` (`#ff9d4a`) nas demais, na lente e na luz do chão.
3. The system SHALL iluminar o chão sob cada poste: na grade de luz, a célula sob a lente tem intensidade ≥ 0.9 da cor do poste, a célula a 9 m ou mais de qualquer poste tem 0, e a intensidade diminui sempre que a distância aumenta.
4. WHILE o carro está parado numa avenida do centro, the system SHALL mostrar o asfalto sob um poste com luminância ≥ 1.3 × a do asfalto no meio do caminho entre dois postes, na mesma imagem.
5. The system SHALL desenhar todos os postes do mundo em 1 draw call por passe, contra 2 hoje.

**Independent test:** `tests/unit/lampLight.test.ts` sobre a grade do seed 1337, e a sonda de luminância do asfalto no browser.

### S2: asfalto molhado sem confete (P1)

**Acceptance Criteria**

6. WHEN uma fonte pequena e brilhante fica acima do asfalto do centro, à frente da câmera, THEN the system SHALL desenhar o reflexo dela como uma faixa vertical: a altura da mancha refletida na tela ≥ 3 × a largura.
7. WHEN a mesma fonte é refletida com `mirrorBlur: false` (amostra única) THEN a razão altura/largura SHALL ser ≤ 1.5, para a sonda do AC 6 não passar com o reflexo nítido.
8. The system SHALL alongar a faixa com a distância: para a mesma fonte a 20 m e a 60 m da câmera, a altura na tela da faixa a 60 m, dividida pela altura da fonte na tela, SHALL ser maior que a mesma razão a 20 m.
9. The system SHALL nunca refletir mais brilho do que chega do alvo do espelho: a cor refletida é o alvo multiplicado por um tom ≤ 1 em cada canal e por um fator de Fresnel em [0, 1]. Nenhum `blendOverlay` fica no shader.
10. The system SHALL manter as provas do espelho da residuals com os limites de hoje: cintilação com a câmera andando ≤ 0.001 acima da medida sem espelho, ≥ 0.003 com `mirrorBlur: false`, alvo `floor(largura × 0.5) × floor(altura × 0.5)`, ganho de brilho ≥ 0.6 × o do reflexo nítido.

**Independent test:** sonda DEV `render.mirrorStreak` numa página, com a fonte a 20 e 60 m.

### S3: céu com horizonte (P1)

**Acceptance Criteria**

11. WHILE o carro está no spawn, com a câmera parada, the system SHALL mostrar, na coluna central da imagem, a faixa logo acima da silhueta dos prédios mais clara que o topo da tela: luminância média ≥ 1.5 × a das 10 % de linhas de cima.
12. The system SHALL usar a mesma cor, `SKY_HORIZON`, na névoa e no horizonte da cúpula.
13. The system SHALL desenhar a silhueta de prédios distantes pela função pura `skylineHeight(azimute)`: altura entre 0.02 e 0.08 (fração do raio), com pelo menos 60 degraus distintos numa volta e a mesma altura para o mesmo azimute sempre.
14. The system SHALL manter a cúpula centrada na câmera a cada quadro e fora do espelho da rua.
15. The system SHALL não mudar nenhum pixel do céu com a câmera e o tempo parados: diferença entre dois quadros a 1 s de simulação = 0 na faixa de cima da tela, com os letreiros fora do enquadramento.

**Independent test:** sonda DEV `render.skyProfile` com a câmera do spawn.

### S4: letreiros e janelas com cara de cidade (P2)

**Acceptance Criteria**

16. The system SHALL desenhar cada letreiro como uma caixa de 0.12 m de espessura com moldura escura e tubos de neon desenhados na face da frente e na de trás. Os tubos cobrem entre 15 % e 45 % da face, com o padrão escolhido por letreiro a partir da semente dele.
17. The system SHALL manter os 4 materiais de letreiro, um por cor, com `emissiveIntensity` no respiro de hoje, em [2.0, 3.2].
18. The system SHALL dar a cada janela acesa uma de três cores fixas pela semente dela: quente `#ffd9a0` (70 % ± 5 %), fria `#cfe0ff` (20 % ± 5 %) e azul de TV `#7fa8ff` (10 % ± 5 %), contadas sobre as janelas acesas das fachadas do seed 1337. A cor da janela não depende do tempo.
19. The system SHALL manter a janela estável com a câmera andando (`render.shimmer(0.05, { mirror: false })` < 0.01) e as provas da facade-glint com os limites de hoje.

**Independent test:** teste unitário da função de cor de janela e da cobertura dos tubos; sonda DEV do letreiro no browser.

### S5: orçamento e calma (P1)

**Acceptance Criteria**

20. WHILE a corrida está no grid do centro com os 4 carros, the system SHALL fazer ≤ 218 draw calls por quadro.
21. The system SHALL fazer ≤ 220 draw calls nas 5 poses de câmera de `render.spec.ts`.
22. The system SHALL não criar nenhuma variação de brilho no tempo além do respiro dos letreiros: postes, grade de luz no chão, céu, silhueta e janelas não leem o tempo.
23. WHERE a qualidade é `low` the system SHALL desenhar os postes novos, a luz no chão, o céu e os letreiros novos; só o espelho da rua continua desligado, como hoje.

**Independent test:** `tests/e2e/render.spec.ts` e `race.spec.ts` (orçamento); unitários de pureza no tempo.

## Out of scope

| Excluded | Why |
| --- | --- |
| luz real (`PointLight`/`SpotLight`) por poste | milhares de postes; a grade de luz dá o mesmo efeito no chão sem custo por quadro |
| a luz dos postes iluminando carros e fachadas | a grade só vale para o chão. Carro e fachada seguem com hemi, lua e farol; volta na `car-look` se fizer falta |
| reflexo em tela (SSR) | opção recusada pelo usuário em 2026-09-29 (faixas verticais escolhidas) |
| estrelas, lua visível, nuvens | estrela pisca por natureza, e o usuário é sensível a luz piscando; nuvens foram a opção não escolhida |
| texto legível nos letreiros | exigiria fonte e atlas de glifos; tubos abstratos bastam para ler como letreiro |
| visual do carro, sensação de velocidade, HUD | features `car-look`, `speed-feel` e `hud-look`, na fila decidida em 2026-09-29 |

## Assumptions

| Assumption | Chosen default | Rationale | Confirmed? |
| --- | --- | --- | --- |
| reflexo | faixas verticais que crescem com a distância, com Fresnel e sem overlay | escolha do usuário em 2026-09-29 | y |
| cor da luz | mistura por bairro: LED no centro, nas avenidas e no anel (`highway`), sódio no resto | escolha do usuário em 2026-09-29 | y |
| céu | degradê com brilho no horizonte, silhueta de prédios e névoa da mesma cor | escolha do usuário em 2026-09-29 | y |
| letreiros e janelas | letreiro com moldura e tubos; três cores fixas de janela | user delegated ("siga até o fim com recomendadas") | y |
| altura e braço do poste | haste de 6 m (a de hoje) e braço de 1.6 m | a haste de 6 m já está provada por outros checks e posições; o braço leva a lente para cima da faixa externa | y |
| alcance da luz no chão | raio de 9 m com queda quadrática suave | os postes ficam a 40 m um do outro: manchas separadas com escuro entre elas, o ritmo de rua noturna do NFSU2 | y |
| orçamento | ≤ 218 no grid da corrida | a feature tira 1 draw call líquida (postes −2, céu +1); o teto de 220 continua | y |

**Open questions:** none - all resolved or logged above.

## Observable

| Surface | Decision | Landing |
| --- | --- | --- |
| tela de jogo (cidade) | densidade: quanta luz no chão e onde | AC 3, AC 4 |
| tela de jogo (cidade) | ordenação visual: o que brilha mais que o quê | AC 9 (reflexo nunca mais forte que a fonte) |
| tela de jogo (cidade) | estado de qualidade baixa | AC 23 |
| tela de jogo (cidade) | estado vazio, erro e não autorizado | n/a - cena contínua, sem dado do usuário nem conta; falha de shader cai no overlay de erro de hoje |
| tela de jogo (cidade) | ação destrutiva confirma | n/a - nenhuma ação nova |

## Sources

- escolhas do usuário em 2026-09-29: reflexo em faixas verticais, luz por bairro, céu com brilho e silhueta, "siga até o fim com recomendadas"
- `docs/screenshots/01-centro-acelerando.jpg`, `docs/screenshots/02-curva.jpg` - o estado de antes
