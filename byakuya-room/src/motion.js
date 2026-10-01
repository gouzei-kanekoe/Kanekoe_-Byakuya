import { clamp, Spring } from "./state.js";

// One contact has a fixed anchor. Only its neighbourhood follows the hand.
export function contactWeight(point, anchor) {
  return Math.exp(
    -((point.x - anchor.x) ** 2 + (point.y - anchor.y) ** 2) * 5.8,
  );
}
export function boundedPull(x, y, limit = 0.58) {
  const distance = Math.hypot(x, y);
  const amount = distance
    ? (limit * Math.tanh(distance / limit)) / distance
    : 1;
  return { x: x * amount, y: y * amount };
}
export class LocalTouch {
  constructor() {
    this.x = new Spring(0, 120, 22);
    this.y = new Spring(0, 120, 22);
    this.pressure = new Spring(0, 140, 24);
  }
  step(dt, target) {
    return {
      x: this.x.step(dt, target.x),
      y: this.y.step(dt, target.y),
      pressure: this.pressure.step(dt, target.pressure),
    };
  }
}
export class CompanionContact {
  constructor() {
    this.calmFor = 0;
  }
  step(dt, touching, pull, rough = false) {
    if (touching && pull < 0.22 && !rough) this.calmFor += dt;
    else this.calmFor = 0;
    const value = touching ? clamp((this.calmFor - 1.2) / 1.5, 0, 1) : 0;
    return value * value * (3 - 2 * value);
  }
}

// Numeric features morph, so a new emotion never replaces the whole face.
const faces = {
  idle: [1, 0, 0, 0.58, 0, 0],
  happy: [0.12, -0.8, 0, 0.95, 0, 0.12],
  excited: [0.08, -0.9, 0, 1, 0.12, 0.18],
  tired: [0.05, 0.38, 0, 0.12, 0, 0],
  sad: [0.82, 0.08, 0.2, -0.4, 0, 0],
  annoyed: [0.22, 0.04, -0.5, -0.3, 0, 0],
  squeezed: [0.08, -0.55, 0.12, 0.82, 0.04, 0.1],
  surprised: [1.12, 0, 0, 0.25, 0.46, 0],
};
export class FaceMotion {
  constructor() {
    this.features = [...faces.idle];
  }
  step(dt, mood) {
    const target = faces[mood] ?? faces.idle;
    const amount = 1 - Math.exp(-clamp(dt, 0, 0.1) * 3.1);
    this.features = this.features.map((v, i) => v + (target[i] - v) * amount);
    return this.features;
  }
}
