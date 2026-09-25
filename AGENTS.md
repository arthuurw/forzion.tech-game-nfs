# Jogo - agent notes

Jogo de corrida de rua no browser, estilo Need for Speed Underground 2. Vite + TypeScript vanilla,
Three.js para render, Rapier (WASM) para física. Decisões de projeto e roadmap em `.specs/STATE.md`.

## Comandos

```bash
npm run dev        # vite dev server (porta 5173)
npm run build      # build de produção
npm test           # vitest (unitários, src puro)
npm run test:e2e   # playwright chromium contra o dev server
```

## Layout

`src/{core,world,vehicle,camera,hud,audio}/`. Lógica pura (sem import de `three` nem
`@dimforge/rapier3d-compat`) fica em arquivos separados e é testada com vitest. Integração com
o browser é testada com Playwright lendo `window.__game` (só existe em `import.meta.env.DEV`).

## tlc-spec-lean

profile: standard
budget: 150k
