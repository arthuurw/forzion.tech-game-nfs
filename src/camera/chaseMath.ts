/**
 * Matemática pura da câmera de perseguição. Heading 0 = carro apontando +Z
 * (door 9); a câmera fica 6 m atrás e 2.5 m acima, olhando 1 m acima do carro.
 */
export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export const CHASE_DISTANCE = 6;
export const CHASE_HEIGHT = 2.5;
export const CHASE_LOOK_HEIGHT = 1;
export const CHASE_SMOOTHING = 5; // por segundo

export function chaseTarget(carPos: Vec3, heading: number): { position: Vec3; lookAt: Vec3 } {
  const fx = Math.sin(heading);
  const fz = Math.cos(heading);
  return {
    position: {
      x: carPos.x - fx * CHASE_DISTANCE,
      y: carPos.y + CHASE_HEIGHT,
      z: carPos.z - fz * CHASE_DISTANCE,
    },
    lookAt: { x: carPos.x, y: carPos.y + CHASE_LOOK_HEIGHT, z: carPos.z },
  };
}

/** Fração do caminho até o alvo percorrida neste frame: 1 - e^(-5·dt). */
export function smoothingFactor(dt: number): number {
  return 1 - Math.exp(-CHASE_SMOOTHING * dt);
}
