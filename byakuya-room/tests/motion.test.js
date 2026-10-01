import test from "node:test";
import assert from "node:assert/strict";
import {
  boundedPull,
  contactWeight,
  LocalTouch,
  FaceMotion,
  CompanionContact,
} from "../src/motion.js";
import { ByakuyaState } from "../src/state.js";

test("局部拉動靠近接觸點，遠處保持原位", () => {
  const anchor = { x: 0.6, y: 0.2 };
  assert.equal(contactWeight(anchor, anchor), 1);
  assert.ok(contactWeight({ x: -0.6, y: -0.2 }, anchor) < 0.0001);
  const gentle = boundedPull(0.1, 0.08),
    strong = boundedPull(100, 70);
  assert.ok(gentle.x > 0.095 && gentle.y > 0.075);
  assert.ok(Math.hypot(strong.x, strong.y) <= 0.580001);
});
test("局部拉動和壓力放開後連續恢復，不產生投擲位置", () => {
  const touch = new LocalTouch();
  let result;
  for (let i = 0; i < 60; i++)
    result = touch.step(1 / 60, { x: 0.45, y: -0.15, pressure: 0.08 });
  assert.ok(result.x > 0.4);
  const before = result.x;
  result = touch.step(1 / 60, { x: 0, y: 0, pressure: 0 });
  assert.ok(result.x > 0 && result.x < before);
  for (let i = 0; i < 180; i++)
    result = touch.step(1 / 60, { x: 0, y: 0, pressure: 0 });
  assert.ok(
    Math.hypot(result.x, result.y) < 0.00001 &&
      Math.abs(result.pressure) < 0.00001,
  );
});
test("中途改變心情時，眼睛和嘴巴從當下表情繼續變化", () => {
  const f = new FaceMotion(),
    initial = [...f.features];
  f.step(1 / 60, "happy");
  assert.ok(f.features[0] < initial[0] && f.features[0] > 0.9);
  for (let i = 0; i < 20; i++) f.step(1 / 60, "happy");
  const halfway = [...f.features];
  f.step(1 / 60, "annoyed");
  assert.ok(f.features.every((v, i) => Math.abs(v - halfway[i]) < 0.08));
  for (let i = 0; i < 180; i++) f.step(1 / 60, "annoyed");
  assert.ok(Math.abs(f.features[2] + 0.5) < 0.001);
});
test("依偎只在輕柔停留後出現，手離開或拉得較大即解除", () => {
  const contact = new CompanionContact();
  assert.equal(contact.step(0.1, true, 0), 0);
  let close = 0;
  for (let i = 0; i < 30; i++) close = contact.step(0.1, true, 0.1);
  assert.equal(close, 1);
  assert.equal(contact.step(0.1, false, 0), 0);
  for (let i = 0; i < 30; i++) assert.equal(contact.step(0.1, true, 0.4), 0);
  for (let i = 0; i < 30; i++)
    assert.equal(contact.step(0.1, true, 0, true), 0);
});
test("疲倦時自行到坐墊抱熊，接觸喚醒後不立即再次休息", () => {
  const s = new ByakuyaState();
  s.energy = 0.2;
  for (let i = 0; i < 120; i++) s.step(0.05);
  assert.equal(s.resting, true);
  assert.equal(s.hasBear, true);
  const before = s.energy;
  for (let i = 0; i < 200; i++) s.step(0.05);
  assert.ok(s.energy > before);
  s.interact("pet");
  assert.equal(s.resting, false);
  for (let i = 0; i < 80; i++) s.step(0.05);
  assert.equal(s.resting, false);
});
test("安靜待一會才去坐墊，恢復精神後回到飄浮", () => {
  const s = new ByakuyaState();
  for (let i = 0; i < 700; i++) s.step(0.05);
  assert.equal(s.resting, false);
  for (let i = 0; i < 160; i++) s.step(0.05);
  assert.equal(s.resting, true);
  for (let i = 0; i < 460; i++) s.step(0.05);
  assert.equal(s.resting, false);
});
