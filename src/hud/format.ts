import { RPM_MAX, RPM_MIN } from '../vehicle/drivetrain';

/** m/s -> km/h inteiro, sempre positivo (a ré é mostrada pela marcha `R`). */
export function formatSpeed(speedMs: number): string {
  return String(Math.round(Math.abs(speedMs * 3.6)));
}

export function gearLabel(gear: number): string {
  return gear === -1 ? 'R' : String(gear);
}

/** Largura da barra de RPM em porcentagem (0..100). */
export function rpmBarWidth(rpm: number): number {
  return ((rpm - RPM_MIN) / (RPM_MAX - RPM_MIN)) * 100;
}
