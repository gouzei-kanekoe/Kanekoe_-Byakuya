import test from "node:test";
import assert from "node:assert/strict";
import { ByakuyaState, Spring } from "../src/state.js";
const advance = (state, seconds) => {
  for (let t = 0; t < seconds; t += 0.05) state.step(0.05);
};

test("快速反覆切燈會讓白夜不開心，但不會熄滅牠", () => {
  const s = new ByakuyaState();
  for (let i = 0; i < 4; i++) {
    s.setLamp(!s.lampOn);
    advance(s, 0.25);
  }
  assert.equal(s.mood, "annoyed");
  assert.ok(s.brightness > 0.25);
});
test("正常間隔的切燈不會累积成惱怒", () => {
  const s = new ByakuyaState();
  for (let i = 0; i < 6; i++) {
    s.setLamp(!s.lampOn);
    advance(s, 3);
  }
  assert.equal(s.upset, 0);
});
test("相同開燈指令不會當成快速反覆切燈", () => {
  const s = new ByakuyaState();
  for (let i = 0; i < 10; i++) s.setLamp(true);
  assert.equal(s.upset, 0);
});
test("摸摸與抱抱能安撫生氣的白夜", () => {
  const s = new ByakuyaState();
  for (let i = 0; i < 4; i++) s.setLamp(!s.lampOn);
  const brightness = s.brightness;
  s.interact("pet");
  s.interact("hug");
  assert.ok(s.upset < 0.4);
  assert.ok(s.brightness > brightness);
  s.interact("hug");
  assert.equal(s.mood, "happy");
});
test("多次輕拉會疲倦，抱抱之後可以恢復精神", () => {
  const s = new ByakuyaState();
  for (let i = 0; i < 23; i++) s.interact("stretch", 0.6);
  assert.equal(s.mood, "tired");
  const dim = s.brightness;
  s.interact("hug");
  assert.notEqual(s.mood, "tired");
  assert.ok(s.brightness > dim);
});
test("抱小小熊休息時恢復得較快", () => {
  const a = new ByakuyaState(),
    b = new ByakuyaState();
  a.energy = b.energy = 0.2;
  b.setBear(true);
  advance(a, 15);
  advance(b, 15);
  assert.ok(b.energy > a.energy);
});
test("柔軟形變放開後會回到原本體型", () => {
  const spring = new Spring();
  for (let i = 0; i < 45; i++) spring.step(1 / 60, 0.72);
  assert.ok(spring.value < 0.8);
  for (let i = 0; i < 180; i++) spring.step(1 / 60, 1);
  assert.ok(Math.abs(spring.value - 1) < 0.001);
  assert.ok(Math.abs(spring.velocity) < 0.001);
});
test("長時間休息與重複互動的數值仍在範圍內", () => {
  const s = new ByakuyaState();
  for (let i = 0; i < 1000; i++) {
    s.interact("hug");
    s.step(0.05);
  }
  assert.ok(s.energy <= 1 && s.comfort <= 1 && s.upset >= 0);
});
test("未知互動不會改變白夜的狀態", () => {
  const s = new ByakuyaState(),
    before = s.snapshot();
  assert.equal(s.interact("throw"), false);
  assert.deepEqual(s.snapshot(), before);
});
