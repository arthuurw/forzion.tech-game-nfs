import type { CarState } from '../vehicle/Car';
import { formatSpeed, gearLabel, rpmBarWidth } from './format';

/** Velocímetro, marcha e barra de RPM em DOM puro. */
export class Hud {
  private readonly speedEl: HTMLElement;
  private readonly gearEl: HTMLElement;
  private readonly rpmEl: HTMLElement;
  private lastSpeed = '';
  private lastGear = '';

  constructor(root: HTMLElement) {
    this.speedEl = must(root, '#speed');
    this.gearEl = must(root, '#gear');
    this.rpmEl = must(root, '#rpm-fill');
  }

  update(state: CarState): void {
    const speed = formatSpeed(state.speedMs);
    if (speed !== this.lastSpeed) {
      this.speedEl.textContent = speed;
      this.lastSpeed = speed;
    }
    const gear = gearLabel(state.gear);
    if (gear !== this.lastGear) {
      this.gearEl.textContent = gear;
      this.lastGear = gear;
    }
    this.rpmEl.style.width = `${rpmBarWidth(state.rpm).toFixed(1)}%`;
  }
}

function must(root: ParentNode, selector: string): HTMLElement {
  const el = root.querySelector<HTMLElement>(selector);
  if (!el) throw new Error(`HUD: elemento ${selector} não encontrado`);
  return el;
}
