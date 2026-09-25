import { RPM_MAX, RPM_MIN } from '../vehicle/drivetrain';

export const ENGINE_FREQ_MIN_HZ = 60;
export const ENGINE_FREQ_MAX_HZ = 200;
export const AMBIENT_GAIN = 0.3;
export const ENGINE_GAIN = 0.5;

/** RPM 1000..7000 -> 60..200 Hz, linear. */
export function engineFrequency(rpm: number): number {
  const t = (rpm - RPM_MIN) / (RPM_MAX - RPM_MIN);
  return ENGINE_FREQ_MIN_HZ + t * (ENGINE_FREQ_MAX_HZ - ENGINE_FREQ_MIN_HZ);
}
