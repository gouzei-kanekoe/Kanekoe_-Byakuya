export const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
export class ByakuyaState {
  constructor() {
    this.time = 0;
    this.energy = 0.82;
    this.comfort = 0.65;
    this.upset = 0;
    this.lampOn = true;
    this.hasBear = false;
    this.reaction = "idle";
    this.reactionUntil = 0;
    this.lightChanges = [];
    this.lastInteraction = 0;
    this.resting = false;
    this.restStarted = 0;
    this.nextRestAt = 40;
  }
  interact(kind, strength = 1) {
    strength = clamp(strength, 0, 1);
    const response = {
      poke: [-0.007, 0.025, 0.015, "surprised", 1.1],
      pet: [0.016, 0.085, 0.11, "happy", 2.2],
      rub: [-0.035, 0.045, 0.04, "happy", 1.5],
      squish: [-0.035, 0.018, 0, "squeezed", 1.3],
      stretch: [-0.045, 0.015, 0, "surprised", 1.5],
      hug: [0.24, 0.23, 0.42, "happy", 4],
    }[kind];
    if (!response) return false;
    this.lastInteraction = this.time;
    this.resting = false;
    this.nextRestAt = this.time + 40;
    this.energy = clamp(this.energy + response[0] * strength, 0, 1);
    this.comfort = clamp(this.comfort + response[1] * strength, 0, 1);
    this.upset = clamp(this.upset - response[2] * strength, 0, 1);
    if (["squish", "stretch"].includes(kind) && strength > 0.86) {
      this.upset = clamp(this.upset + 0.055, 0, 1);
      this.comfort = clamp(this.comfort - 0.035, 0, 1);
    }
    this.reaction = response[3];
    this.reactionUntil = this.time + response[4];
    return true;
  }
  setLamp(on) {
    if (this.lampOn === Boolean(on)) return false;
    this.lampOn = Boolean(on);
    this.lightChanges = this.lightChanges.filter((t) => this.time - t < 2.6);
    this.lightChanges.push(this.time);
    if (this.lightChanges.length >= 4) {
      this.upset = Math.max(this.upset, 0.9);
      this.energy = clamp(this.energy - 0.035, 0, 1);
      this.reaction = "annoyed";
      this.reactionUntil = this.time + 5;
      return true;
    }
    return false;
  }
  setBear(held) {
    this.hasBear = Boolean(held);
    if (this.hasBear) {
      this.comfort = clamp(this.comfort + 0.055, 0, 1);
      this.upset = clamp(this.upset - 0.06, 0, 1);
    }
  }
  step(dt) {
    dt = clamp(dt, 0, 0.1);
    this.time += dt;
    this.upset = Math.max(0, this.upset - dt * 0.018);
    const quiet = this.time - this.lastInteraction;
    if (
      !this.resting &&
      quiet > 5 &&
      (this.energy < 0.3 || (quiet > 35 && this.time > this.nextRestAt))
    ) {
      this.resting = true;
      this.restStarted = this.time;
      this.setBear(true);
    }
    if (
      this.resting &&
      this.time - this.restStarted > 20 &&
      this.energy > 0.72
    ) {
      this.resting = false;
      this.nextRestAt = this.time + 65;
    }
    if (this.time - this.lastInteraction > 3)
      this.energy = clamp(
        this.energy +
          dt * (this.resting ? 0.018 : this.hasBear ? 0.009 : 0.003),
        0,
        1,
      );
    this.comfort = Math.max(0.4, this.comfort - dt * 0.0006);
  }
  get mood() {
    if (this.upset > 0.62) return "annoyed";
    if (this.upset > 0.25) return "sad";
    if (this.energy < 0.3) return "tired";
    if (this.time < this.reactionUntil) return this.reaction;
    if (this.energy > 0.88 && this.comfort > 0.84) return "excited";
    return "idle";
  }
  get brightness() {
    return clamp(
      0.42 + this.energy * 0.45 + this.comfort * 0.18 - this.upset * 0.17,
      0.25,
      1,
    );
  }
  snapshot() {
    return {
      mood: this.mood,
      energy: this.energy,
      comfort: this.comfort,
      lampOn: this.lampOn,
      hasBear: this.hasBear,
      resting: this.resting,
    };
  }
}
export class Spring {
  constructor(value = 1, stiffness = 150, damping = 17) {
    this.value = value;
    this.velocity = 0;
    this.stiffness = stiffness;
    this.damping = damping;
  }
  step(dt, target) {
    const h = clamp(dt, 0, 0.05) / 4;
    for (let i = 0; i < 4; i++) {
      this.velocity +=
        ((target - this.value) * this.stiffness -
          this.velocity * this.damping) *
        h;
      this.value += this.velocity * h;
    }
    return this.value;
  }
}
