import { describe, expect, it } from 'vitest';
import {
  computeDrive,
  gearFor,
  rpmFor,
  steeringAngleFor,
  type DriveInput,
} from '../../src/vehicle/drivetrain';

const idle: DriveInput = { throttle: false, brake: false, steer: 0, handbrake: false };

describe('drivetrain', () => {
  // C2 (AC 2)
  it('brake when moving forward', () => {
    const cmd = computeDrive({ ...idle, brake: true }, 40);
    expect(cmd.engineForce).toBe(0);
    expect(cmd.brakeFront).toBeGreaterThan(0);
    expect(cmd.brakeRear).toBeGreaterThan(0);
    expect(cmd.brakeFront).toBe(cmd.brakeRear);
  });

  // C4 (AC 3)
  it('reverse below 1 kmh and capped at 30', () => {
    expect(computeDrive({ ...idle, brake: true }, 1).engineForce).toBeLessThan(0);
    expect(computeDrive({ ...idle, brake: true }, 0).engineForce).toBeLessThan(0);
    expect(computeDrive({ ...idle, brake: true }, -29).engineForce).toBeLessThan(0);
    expect(computeDrive({ ...idle, brake: true }, -31).engineForce).toBe(0);
  });

  // C6 (AC 4)
  it('steering angle decays with speed', () => {
    expect(steeringAngleFor(0)).toBeCloseTo(0.5, 5);
    expect(steeringAngleFor(75)).toBeCloseTo(0.325, 5);
    expect(steeringAngleFor(150)).toBeCloseTo(0.15, 5);
    expect(steeringAngleFor(200)).toBeCloseTo(0.15, 5);
    expect(computeDrive({ ...idle, steer: 1 }, 0).steer).toBeCloseTo(0.5, 5);
    expect(computeDrive({ ...idle, steer: -1 }, 0).steer).toBeCloseTo(-0.5, 5);
  });

  // C7 (AC 5)
  it('handbrake brakes rear wheels and cuts rear grip to 0.4', () => {
    const cmd = computeDrive({ ...idle, handbrake: true }, 60);
    expect(cmd.brakeFront).toBe(0);
    expect(cmd.brakeRear).toBeGreaterThan(0);
    expect(cmd.rearFrictionFactor).toBeCloseTo(0.4, 5);
    expect(computeDrive(idle, 60).rearFrictionFactor).toBe(1);
  });

  // C8 (AC 6)
  it('engine force cut at 220 kmh', () => {
    expect(computeDrive({ ...idle, throttle: true }, 219).engineForce).toBeGreaterThan(0);
    expect(computeDrive({ ...idle, throttle: true }, 220).engineForce).toBe(0);
    expect(computeDrive({ ...idle, throttle: true }, 230).engineForce).toBe(0);
  });

  // C27 (AC 21) - table-driven over the 7 gears
  it('gear bands', () => {
    const table: Array<[number, number]> = [
      [-5, -1],
      [0, 1],
      [29.9, 1],
      [30, 2],
      [60, 3],
      [95, 4],
      [130, 5],
      [170, 6],
      [200, 6],
    ];
    for (const [kmh, gear] of table) {
      expect(gearFor(kmh), `gear at ${kmh} km/h`).toBe(gear);
    }
    expect(new Set(table.map(([, g]) => g)).size).toBe(7);
  });

  // C28 (AC 22)
  it('rpm within gear band', () => {
    expect(rpmFor(0)).toBeCloseTo(1000, 3);
    expect(rpmFor(15)).toBeCloseTo(4000, 3);
    expect(rpmFor(29.9)).toBeCloseTo(6980, 3);
    expect(rpmFor(30)).toBeCloseTo(1000, 3);
    for (let kmh = -50; kmh <= 250; kmh += 0.5) {
      const rpm = rpmFor(kmh);
      expect(rpm, `rpm at ${kmh}`).toBeGreaterThanOrEqual(1000);
      expect(rpm, `rpm at ${kmh}`).toBeLessThanOrEqual(7000);
    }
  });
});
