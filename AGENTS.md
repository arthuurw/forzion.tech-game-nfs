# Jogo - agent notes

Jogo de corrida de rua no browser, estilo Need for Speed Underground 2. Vite + TypeScript vanilla,
Three.js para render, Rapier (WASM) para física. Visão geral para humanos em `README.md`;
decisões de projeto (AD-NNN), roadmap e handoff em `.specs/STATE.md`.

## Comandos

```bash
npm run dev             # vite dev server (porta 5173)
npm run build           # tsc --noEmit + build de produção
npm test                # vitest: tests/unit e tests/physics (Rapier real em node), tudo
npm run test:quick      # vitest sem a tag `slow` (~16 s), para iterar
npm run test:e2e        # playwright chromium contra o dev server (24.6 min medidos com 2 workers; E2E_WORKERS muda os workers, E2E_PORT a porta)
npm run test:e2e:smoke  # só os testes `@smoke` (2 por arquivo, 2.4 min medidos), para iterar
npm run fetch:textures  # baixa de novo as texturas CC0 do ambientCG
```

## Layout

`src/{core,world,vehicle,camera,hud,audio,post,race}/`, com `world/{terrain,roads,lots,interiors,rail}/`
(AD-018; pasta nova de topo só com AD nova).
Lógica pura (sem import de `three` nem `@dimforge/rapier3d-compat`) fica em arquivos separados e
é testada com vitest; a lista de módulos puros é travada em `tests/unit/purity.test.ts`.
Dirigibilidade é medida com o `Car` real em `tests/physics/` (AD-011). Integração com o browser é
testada com Playwright lendo `window.__game` (só existe em `import.meta.env.DEV`).

Ajustes do carro ficam em `DEFAULT_CAR` (`src/vehicle/carSpec.ts`). As duas ajudas arcade
(`yawAssist.ts`, `cornerAssist.ts`) são as únicas permitidas (AD-014).

## Worktrees de agentes

Worktrees em `.claude/worktrees/` usam o `node_modules` do checkout principal por junction. Antes
de qualquer `git worktree remove`, apague a junction com PowerShell
`(Get-Item <wt>\node_modules).Delete()`; senão o remove segue a junction e apaga os pacotes
compartilhados. Suítes em paralelo usam `E2E_PORT` diferente de 5173. O e2e não reaproveita um
servidor já de pé na porta (seria o de outro checkout); para reaproveitar de propósito, `E2E_REUSE=1`.

## Git

Commits com o e-mail noreply do GitHub (configurado no repositório). O remoto é público:
`git push` só com ok explícito do usuário.

## tlc-spec-lean

profile: standard
budget: 150k
