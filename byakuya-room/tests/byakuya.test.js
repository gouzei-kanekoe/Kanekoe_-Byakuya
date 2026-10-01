import test from "node:test";
import assert from "node:assert/strict";
import {
  HAND_LENGTH,
  SHAPE,
  basePoint,
  deformPoint,
  handPose,
  insideContour,
  mochiContour,
} from "../src/byakuya.js";
import { Blinker, LocalTouch } from "../src/motion.js";
import { Spring } from "../src/state.js";

const span = (points, keep) => {
  const xs = points.filter(keep).map((p) => p.x);
  return Math.max(...xs) - Math.min(...xs);
};

test("白夜是麻糬形：比高度寬，底部比頂部平", () => {
  const points = mochiContour({}, 80);
  const width = span(points, () => true),
    height = Math.max(...points.map((p) => p.y)) - Math.min(...points.map((p) => p.y));
  assert.ok(width > height * 1.2);
  const flatBottom = span(points, (p) => p.y > SHAPE.bottom * 0.9),
    roundTop = span(points, (p) => p.y < -SHAPE.top * 0.9);
  assert.ok(flatBottom > roundTop * 1.3);
});

test("輪廓上下連續，沒有斷開的接縫", () => {
  const points = mochiContour({}, 120);
  for (let i = 0; i < points.length; i++) {
    const a = points[i],
      b = points[(i + 1) % points.length];
    assert.ok(Math.hypot(a.x - b.x, a.y - b.y) < 0.12);
  }
  assert.ok(Math.abs(basePoint(0).x - 1) < 1e-9 && Math.abs(basePoint(0).y) < 1e-9);
});

test("局部拉動只拉長靠近手的那一側", () => {
  const base = mochiContour({}, 40),
    pulled = mochiContour({ touch: { x: 0.8, y: 0 }, pull: { x: 0.4, y: 0 } }, 40);
  const moved = base.map((p, i) => Math.hypot(pulled[i].x - p.x, pulled[i].y - p.y));
  const right = moved[0],
    left = moved[20];
  assert.ok(right > 0.25);
  assert.ok(left < 0.01);
  assert.ok(pulled[0].x > base[0].x);
});

test("放開後輪廓回到原本的麻糬形", () => {
  const touch = new LocalTouch();
  let state;
  for (let i = 0; i < 40; i++) state = touch.step(1 / 60, { x: 0.5, y: -0.2, pressure: 0.1 });
  for (let i = 0; i < 240; i++) state = touch.step(1 / 60, { x: 0, y: 0, pressure: 0 });
  const base = mochiContour({}),
    after = mochiContour({ touch: { x: 0.6, y: 0.1 }, pull: state, pressure: state.pressure });
  assert.ok(after.every((p, i) => Math.hypot(p.x - base[i].x, p.y - base[i].y) < 1e-4));
});

test("點擊判定跟著輪廓，外圍留一點寬容", () => {
  const points = mochiContour();
  assert.equal(insideContour(points, 0, 0), true);
  assert.equal(insideContour(points, 0, -0.78), true);
  assert.equal(insideContour(points, 1.3, 0), false);
  assert.equal(insideContour(points, 0, 0.8), false);
  assert.equal(insideContour(points, 1.06, 0), false);
  assert.equal(insideContour(points, 1.06, 0, 1.12), true);
});

test("休息時攤扁，表情跟著身體往下", () => {
  const eye = { x: 0.33, y: -0.02 },
    awake = deformPoint(eye, {}),
    resting = deformPoint(eye, { squash: 0.2 });
  assert.ok(resting.y > awake.y);
  assert.ok(Math.abs(resting.x) > Math.abs(awake.x));
  const bottom = mochiContour({ squash: 0.2 }, 40)[10];
  assert.ok(Math.abs(bottom.y - SHAPE.bottom) < 1e-9);
});

test("小手很短：再遠的目標也只伸出一小截", () => {
  const anchor = { x: 0.8, y: 0.32 },
    far = handPose(anchor, { x: 2.5, y: -1 }, 1),
    near = handPose(anchor, { x: 0.9, y: 0.25 }, 1);
  assert.ok(Math.abs(Math.hypot(far.x - anchor.x, far.y - anchor.y) - HAND_LENGTH) < 1e-9);
  assert.ok(HAND_LENGTH <= 0.25);
  assert.ok(Math.abs(near.x - 0.9) < 1e-9 && Math.abs(near.y - 0.25) < 1e-9);
});

test("小手不抱東西時收回身體裡", () => {
  const anchor = { x: -0.6, y: 0.5 },
    goal = { x: -0.3, y: 0.9 },
    reach = new Spring(0, 60, 11);
  for (let i = 0; i < 60; i++) reach.step(1 / 60, 1);
  const out = handPose(anchor, goal, reach.value);
  assert.ok(Math.hypot(out.x - anchor.x, out.y - anchor.y) > 0.15);
  for (let i = 0; i < 180; i++) reach.step(1 / 60, 0);
  const back = handPose(anchor, goal, reach.value);
  assert.ok(Math.hypot(back.x - anchor.x, back.y - anchor.y) < 0.01);
  assert.equal(handPose(anchor, goal, 3).reach, 1);
});

test("偶爾眨眼，大部分時間眼睛張開", () => {
  const blinker = new Blinker();
  let closedFrames = 0,
    blinks = 0,
    wasClosed = false;
  for (let i = 0; i < 60 * 30; i++) {
    const closed = blinker.step(1 / 60) > 0.5;
    if (closed) closedFrames++;
    if (closed && !wasClosed) blinks++;
    wasClosed = closed;
  }
  assert.ok(blinks >= 4 && blinks <= 14);
  assert.ok(closedFrames / (60 * 30) < 0.05);
});
