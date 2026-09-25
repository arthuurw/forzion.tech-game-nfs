/**
 * Expõe o objeto de debug como `__game` no alvo (normalmente `window`) apenas
 * quando o build é de desenvolvimento (door 4). Os testes Playwright leem
 * `window.__game`; em produção nada é exposto.
 */
export function exposeDebug(
  env: { DEV: boolean },
  game: unknown,
  target: Record<string, unknown> = globalThis as unknown as Record<string, unknown>,
): void {
  if (!env.DEV) return;
  target.__game = game;
}
