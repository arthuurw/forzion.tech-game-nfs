import type { ResultRow } from '../race/raceProgress';

/** HUD de corrida em DOM puro (races): prompt, contagem, painel (posição, volta, tempo) e resultado. */
export class RaceHud {
  private readonly prompt: HTMLElement;
  private readonly countdown: HTMLElement;
  private readonly panel: HTMLElement;
  private readonly pos: HTMLElement;
  private readonly lap: HTMLElement;
  private readonly time: HTMLElement;
  private readonly results: HTMLElement;
  private readonly last = new Map<HTMLElement, string>();

  constructor(root: HTMLElement) {
    this.prompt = must(root, '#race-prompt');
    this.countdown = must(root, '#race-countdown');
    this.panel = must(root, '#race-panel');
    this.pos = must(root, '#race-pos');
    this.lap = must(root, '#race-lap');
    this.time = must(root, '#race-time');
    this.results = must(root, '#race-results');
  }

  showPrompt(text: string | null): void {
    this.set(this.prompt, text);
  }

  showCountdown(text: string | null): void {
    this.set(this.countdown, text);
  }

  /** `null` esconde o painel; `lap` `null` esconde só a volta (sprint). */
  showPanel(panel: { pos: string; lap: string | null; time: string } | null): void {
    this.visible(this.panel, panel !== null);
    if (!panel) return;
    this.text(this.pos, panel.pos);
    this.set(this.lap, panel.lap);
    this.text(this.time, panel.time);
  }

  showResults(title: string | null, rows: ReadonlyArray<ResultRow> = [], playerName = ''): void {
    this.visible(this.results, title !== null);
    if (title === null) {
      this.last.delete(this.results);
      return;
    }
    const key = title + JSON.stringify(rows);
    if (this.last.get(this.results) === key) return;
    this.last.set(this.results, key);
    this.results.replaceChildren();
    const head = document.createElement('div');
    head.className = 'race-title';
    head.textContent = title;
    this.results.append(head);
    for (const r of rows) {
      const row = document.createElement('div');
      row.className = r.name === playerName ? 'race-row player' : 'race-row';
      for (const t of [String(r.position), r.name, r.time]) {
        const cell = document.createElement('span');
        cell.textContent = t;
        row.append(cell);
      }
      this.results.append(row);
    }
    const hint = document.createElement('div');
    hint.className = 'race-hint';
    hint.textContent = 'ENTER para continuar';
    this.results.append(hint);
  }

  private set(el: HTMLElement, text: string | null): void {
    this.visible(el, text !== null);
    if (text !== null) this.text(el, text);
  }

  private text(el: HTMLElement, text: string): void {
    if (this.last.get(el) === text) return;
    this.last.set(el, text);
    el.textContent = text;
  }

  private visible(el: HTMLElement, on: boolean): void {
    const display = on ? 'block' : 'none';
    if (el.style.display !== display) el.style.display = display;
  }
}

function must(root: ParentNode, selector: string): HTMLElement {
  const el = root.querySelector<HTMLElement>(selector);
  if (!el) throw new Error(`HUD: elemento ${selector} não encontrado`);
  return el;
}
