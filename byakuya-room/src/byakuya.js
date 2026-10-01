import { clamp } from "./state.js";

const TAU = Math.PI * 2;
// Local units: body half-width is 1, y points down like the canvas.
export const SHAPE = { top: 0.84, bottom: 0.66, flat: 2.6 };
// Little paws peek out from the lower sides, and never reach far.
export const HAND_ANCHORS = [
  { x: -0.8, y: 0.32 },
  { x: 0.8, y: 0.32 },
];
export const HAND_LENGTH = 0.22;
const INK = "#4a4862";

// Mochi silhouette: a round dome on top, wider and flatter underneath.
export function basePoint(theta) {
  const c = Math.cos(theta),
    s = Math.sin(theta);
  if (s <= 0) return { x: c, y: s * SHAPE.top };
  const e = 2 / SHAPE.flat;
  return {
    x: Math.sign(c) * Math.abs(c) ** e * (1 + 0.06 * s),
    y: s ** e * SHAPE.bottom,
  };
}

function touchOffset(x, y, nx, ny, touch, pull, pressure) {
  if (!touch) return [0, 0];
  const dx = x - touch.x,
    dy = y - touch.y,
    d2 = dx * dx + dy * dy;
  const w = Math.exp(-d2 * 3);
  let follow = w * 0.4;
  const px = pull?.x ?? 0,
    py = pull?.y ?? 0,
    len = Math.hypot(px, py);
  if (len > 1e-4) {
    // The side facing the hand stretches out after it, like pinched mochi.
    const facing = Math.max(0, (nx * px + ny * py) / len);
    follow += facing ** 3 * Math.exp(-d2 * 1.1) * 0.95;
  }
  let ox = px * follow,
    oy = py * follow;
  ox -= (dx * 0.45 + nx * 0.5) * (pressure ?? 0) * w;
  oy -= (dy * 0.45 + ny * 0.5) * (pressure ?? 0) * w;
  return [ox, oy];
}

// Shared by the outline, the face and the hand anchors so they move together.
export function deformPoint(p, pose = {}, normal) {
  const squash = pose.squash ?? 0,
    breathe = pose.breathe ?? 0;
  let x = p.x * (1 + squash * 0.55) * (1 - breathe * 0.018);
  let y = SHAPE.bottom - (SHAPE.bottom - p.y) * (1 - squash) * (1 + breathe * 0.03);
  const n = normal ?? { x: 0, y: 0 };
  const [ax, ay] = touchOffset(x, y, n.x, n.y, pose.touch, pose.pull, pose.pressure);
  const [bx, by] = touchOffset(x, y, n.x, n.y, pose.touch2, pose.pull2, 0);
  x += ax + bx;
  y += ay + by;
  const lean = pose.lean;
  if (lean && normal) {
    // The side pressed against the hand flattens a little.
    const amount = Math.hypot(lean.x, lean.y);
    if (amount > 1e-4) {
      const facing = Math.max(0, (n.x * lean.x + n.y * lean.y) / amount);
      x -= n.x * facing * amount * 0.12;
      y -= n.y * facing * amount * 0.12;
    }
  }
  return { x, y };
}

export function mochiContour(pose = {}, count = 40) {
  const points = [];
  for (let i = 0; i < count; i++) {
    const theta = (i / count) * TAU,
      p = basePoint(theta),
      length = Math.hypot(p.x, p.y) || 1;
    points.push(deformPoint(p, pose, { x: p.x / length, y: p.y / length }));
  }
  return points;
}

export function insideContour(points, x, y, pad = 1) {
  x /= pad;
  y /= pad;
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const a = points[i],
      b = points[j];
    if (a.y > y !== b.y > y && x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x)
      inside = !inside;
  }
  return inside;
}

export function handPose(anchor, target, reach, maxLength = HAND_LENGTH) {
  reach = clamp(reach, 0, 1);
  const dx = target.x - anchor.x,
    dy = target.y - anchor.y,
    k = Math.min(1, maxLength / (Math.hypot(dx, dy) || 1)) * reach;
  return { x: anchor.x + dx * k, y: anchor.y + dy * k, reach };
}

const smooth = (a, b, v) => {
  const t = clamp((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

function tracePath(ctx, points, v) {
  const n = points.length,
    px = (i) => v.x + points[(i + n) % n].x * v.r,
    py = (i) => v.y + points[(i + n) % n].y * v.r;
  ctx.beginPath();
  ctx.moveTo((px(-1) + px(0)) / 2, (py(-1) + py(0)) / 2);
  for (let i = 0; i < n; i++)
    ctx.quadraticCurveTo(px(i), py(i), (px(i) + px(i + 1)) / 2, (py(i) + py(i + 1)) / 2);
  ctx.closePath();
}

export function drawAura(ctx, v) {
  const r = v.r * (2.5 + v.night * 1.1),
    strength = v.glow * (0.75 + v.night * 0.6);
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const g = ctx.createRadialGradient(v.x, v.y, v.r * 0.4, v.x, v.y, r);
  g.addColorStop(0, `rgba(188,208,255,${0.3 * strength})`);
  g.addColorStop(0.38, `rgba(168,192,255,${0.12 * strength})`);
  g.addColorStop(1, "rgba(160,190,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(v.x - r, v.y - r, r * 2, r * 2);
  ctx.restore();
}

export function drawBody(ctx, points, v) {
  ctx.save();
  tracePath(ctx, points, v);
  const g = ctx.createRadialGradient(
    v.x - v.r * 0.18,
    v.y - v.r * 0.38,
    0,
    v.x,
    v.y - v.r * 0.1,
    v.r * 1.25,
  );
  g.addColorStop(0, "#ffffff");
  g.addColorStop(0.52, "#fdfeff");
  g.addColorStop(0.84, "#eef3ff");
  g.addColorStop(1, "#dce5fa");
  ctx.fillStyle = g;
  ctx.shadowColor = "rgba(226,236,255,0.95)";
  ctx.shadowBlur = v.r * (0.35 + v.glow * 0.45) * v.dpr;
  ctx.fill();
  ctx.shadowBlur = v.r * 0.14 * v.dpr;
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.shadowColor = "transparent";
  ctx.clip();
  // Soft belly shade gives the light a squishy, rounded volume.
  const belly = ctx.createRadialGradient(
    v.x,
    v.y + v.r * 0.85,
    0,
    v.x,
    v.y + v.r * 0.85,
    v.r * 1.05,
  );
  belly.addColorStop(0, `rgba(176,188,232,${0.34 - v.night * 0.1})`);
  belly.addColorStop(1, "rgba(176,188,232,0)");
  ctx.fillStyle = belly;
  ctx.fillRect(v.x - v.r * 2, v.y - v.r * 2, v.r * 4, v.r * 4);
  if (v.dim > 0) {
    ctx.fillStyle = `rgba(150,160,192,${v.dim * 0.22})`;
    ctx.fillRect(v.x - v.r * 2, v.y - v.r * 2, v.r * 4, v.r * 4);
  }
  ctx.fillStyle = "rgba(255,255,255,0.95)";
  ctx.beginPath();
  ctx.ellipse(v.x - v.r * 0.42, v.y - v.r * 0.5, v.r * 0.2, v.r * 0.1, -0.55, 0, TAU);
  ctx.fill();
  ctx.restore();
}

// Short hand-drawn dashes around the body, as in the comic.
const RAYS = Array.from({ length: 14 }, (_, i) => {
  const angle = -Math.PI / 2 + ((i - 6.5) / 14) * Math.PI * 1.62 + Math.sin(i * 2.7) * 0.06;
  return { angle, length: 0.13 + ((i * 7) % 5) * 0.018, phase: i * 1.91, bend: i % 2 ? 1 : -1 };
});
export function drawRays(ctx, points, v) {
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineWidth = v.r * 0.045;
  ctx.shadowColor = "rgba(205,222,255,0.9)";
  ctx.shadowBlur = 5 * v.dpr;
  const visible = Math.round(8 + v.glow * 6);
  for (let i = 0; i < RAYS.length; i++) {
    const ray = RAYS[i];
    if ((i * 5) % 14 >= visible) continue;
    const c = Math.cos(ray.angle),
      s = Math.sin(ray.angle);
    let edge = 0;
    for (const p of points) edge = Math.max(edge, p.x * c + p.y * s);
    const twinkle = v.still ? 1 : 0.82 + 0.18 * Math.sin(v.time * 1.7 + ray.phase);
    const start = edge * v.r + v.r * 0.17,
      length = v.r * ray.length * (0.7 + v.glow * 0.45 + v.happy * 0.25) * twinkle;
    const x0 = v.x + c * start,
      y0 = v.y + s * start,
      x1 = v.x + c * (start + length),
      y1 = v.y + s * (start + length),
      bend = ray.bend * v.r * 0.02;
    ctx.strokeStyle = `rgba(255,255,255,${(0.42 + v.glow * 0.45) * twinkle})`;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.quadraticCurveTo((x0 + x1) / 2 - s * bend, (y0 + y1) / 2 + c * bend, x1, y1);
    ctx.stroke();
  }
  ctx.restore();
}

export function drawFace(ctx, features, pose, v) {
  const [open, bend, tilt, smile, mouth, blush] = features;
  const at = (x, y) => {
    const p = deformPoint({ x: x + v.look.x * 0.07, y: y + v.look.y * 0.05 }, pose);
    return { x: v.x + p.x * v.r, y: v.y + p.y * v.r };
  };
  const r = v.r;
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  for (const side of [-1, 1]) {
    const cheek = at(side * 0.53, 0.14);
    const g = ctx.createRadialGradient(cheek.x, cheek.y, 0, cheek.x, cheek.y, r * 0.13);
    g.addColorStop(0, `rgba(255,152,172,${clamp(0.2 + blush * 1.8, 0, 0.6)})`);
    g.addColorStop(1, "rgba(255,152,172,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(cheek.x, cheek.y, r * 0.13, r * 0.08, 0, 0, TAU);
    ctx.fill();
  }
  ctx.strokeStyle = ctx.fillStyle = INK;
  const eyeOpen = open * (1 - v.blink),
    dot = smooth(0.24, 0.52, eyeOpen);
  for (const side of [-1, 1]) {
    const e = at(side * 0.33, -0.02);
    if (dot > 0.01) {
      ctx.globalAlpha = dot;
      ctx.beginPath();
      ctx.ellipse(e.x, e.y, r * 0.052, r * 0.07 * clamp(eyeOpen, 0.35, 1.15), 0, 0, TAU);
      ctx.fill();
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(e.x + r * 0.016, e.y - r * 0.024 * clamp(eyeOpen, 0.35, 1), r * 0.016, 0, TAU);
      ctx.fill();
      ctx.fillStyle = INK;
    }
    if (dot < 0.99) {
      ctx.globalAlpha = 1 - dot;
      ctx.lineWidth = r * 0.036;
      ctx.beginPath();
      ctx.moveTo(e.x - r * 0.072, e.y);
      ctx.quadraticCurveTo(e.x, e.y + bend * r * 0.13, e.x + r * 0.072, e.y);
      ctx.stroke();
    }
    const brow = clamp(Math.abs(tilt) * 2.4, 0, 1);
    if (brow > 0.02) {
      const b = at(side * 0.33, -0.19);
      ctx.globalAlpha = brow;
      ctx.lineWidth = r * 0.03;
      ctx.beginPath();
      ctx.moveTo(b.x - side * r * 0.065, b.y - tilt * r * 0.07);
      ctx.lineTo(b.x + side * r * 0.065, b.y + tilt * r * 0.07);
      ctx.stroke();
    }
  }
  ctx.globalAlpha = 1;
  const m = at(0, 0.15),
    w = r * 0.07,
    depth = smile * r * 0.07,
    omega = smooth(0.6, 0.95, smile),
    mid = depth * (1 - omega) - r * 0.008 * omega;
  ctx.lineWidth = r * 0.032;
  ctx.beginPath();
  ctx.moveTo(m.x - w, m.y);
  ctx.quadraticCurveTo(m.x - w * 0.55, m.y + depth * 1.15, m.x, m.y + mid);
  ctx.quadraticCurveTo(m.x + w * 0.55, m.y + depth * 1.15, m.x + w, m.y);
  if (mouth > 0.03) {
    const open = mouth * r * 0.22;
    ctx.quadraticCurveTo(m.x, m.y + Math.max(depth, 0) + open, m.x - w, m.y);
    ctx.globalAlpha = clamp(mouth * 4, 0, 1);
    ctx.fillStyle = "#6b5a7c";
    ctx.fill();
    ctx.globalAlpha = 1;
  }
  ctx.stroke();
  ctx.restore();
}

// Short, chubby nubs of light ending in round little paws.
export function drawHands(ctx, hands, v) {
  ctx.save();
  for (const hand of hands) {
    if (hand.reach < 0.02) continue;
    const a = { x: v.x + hand.anchor.x * v.r, y: v.y + hand.anchor.y * v.r },
      t = { x: v.x + hand.x * v.r, y: v.y + hand.y * v.r },
      grow = clamp(hand.reach * 2.2, 0, 1),
      paw = v.r * 0.09 * grow;
    ctx.beginPath();
    for (let i = 0; i <= 8; i++) {
      const k = i / 8,
        x = a.x + (t.x - a.x) * k,
        y = a.y + (t.y - a.y) * k,
        r = v.r * (0.08 + k * 0.01) * grow;
      ctx.moveTo(x + r, y);
      ctx.arc(x, y, r, 0, TAU);
    }
    ctx.shadowColor = "rgba(226,236,255,0.95)";
    ctx.shadowBlur = v.r * 0.18 * v.dpr;
    ctx.fillStyle = "#fbfcff";
    ctx.fill();
    // Soft outline only around the outer edge of the paw.
    ctx.shadowBlur = 0;
    ctx.shadowColor = "transparent";
    const away = Math.atan2(t.y - a.y, t.x - a.x);
    ctx.strokeStyle = `rgba(160,174,222,${0.7 * grow})`;
    ctx.lineWidth = v.r * 0.02;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.arc(t.x, t.y, paw, away - 1.6, away + 1.6);
    ctx.stroke();
  }
  ctx.restore();
}

function chalkStroke(ctx, draw, width) {
  ctx.lineWidth = width;
  ctx.beginPath();
  draw();
  ctx.stroke();
}

export function drawEmotes(ctx, emotes, v) {
  const r = v.r;
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  if (emotes.surprise > 0.02) {
    const x = v.x + r * 0.95,
      y = v.y - r * 0.92,
      pop = 0.8 + 0.2 * emotes.surprise;
    ctx.globalAlpha = emotes.surprise;
    ctx.strokeStyle = ctx.fillStyle = "#ffffff";
    chalkStroke(ctx, () => {
      ctx.moveTo(x, y - r * 0.26 * pop);
      ctx.lineTo(x + r * 0.03, y - r * 0.02);
    }, r * 0.06);
    ctx.beginPath();
    ctx.arc(x + r * 0.035, y + r * 0.08, r * 0.035, 0, TAU);
    ctx.fill();
  }
  if (emotes.sleep > 0.02) {
    ctx.strokeStyle = "#ffffff";
    for (let i = 0; i < 2; i++) {
      const phase = v.still ? 0.4 + i * 0.3 : (v.time * 0.42 + i * 0.5) % 1,
        size = r * (0.09 + phase * 0.08),
        x = v.x + r * (0.62 + phase * 0.35),
        y = v.y - r * (0.72 + phase * 0.55);
      ctx.globalAlpha = emotes.sleep * Math.sin(phase * Math.PI);
      chalkStroke(ctx, () => {
        ctx.moveTo(x - size, y - size);
        ctx.lineTo(x + size, y - size);
        ctx.lineTo(x - size, y + size);
        ctx.lineTo(x + size, y + size);
      }, r * 0.04);
    }
  }
  if (emotes.anger > 0.02) {
    const x = v.x + r * 0.5,
      y = v.y - r * 0.5,
      s = r * 0.085;
    ctx.globalAlpha = emotes.anger;
    ctx.strokeStyle = "#e0707e";
    for (const [dx, dy] of [
      [-1, -1],
      [1, -1],
      [1, 1],
      [-1, 1],
    ])
      chalkStroke(ctx, () => {
        ctx.moveTo(x + dx * s * 1.1, y + dy * s * 0.35);
        ctx.quadraticCurveTo(x + dx * s * 0.35, y + dy * s * 0.35, x + dx * s * 0.35, y + dy * s * 1.1);
      }, r * 0.035);
  }
  if (emotes.love > 0.02) {
    ctx.fillStyle = "#ffb3c4";
    for (let i = 0; i < 2; i++) {
      const phase = v.still ? 0.5 : (v.time * 0.35 + i * 0.5) % 1,
        s = r * (0.06 + phase * 0.03),
        x = v.x + r * (i ? 0.85 : -0.9) + Math.sin(phase * 6 + i) * r * 0.05,
        y = v.y - r * (0.55 + phase * 0.6);
      ctx.globalAlpha = emotes.love * Math.sin(phase * Math.PI);
      ctx.beginPath();
      ctx.moveTo(x, y + s * 0.9);
      ctx.bezierCurveTo(x - s * 1.6, y - s * 0.2, x - s * 0.6, y - s * 1.3, x, y - s * 0.4);
      ctx.bezierCurveTo(x + s * 0.6, y - s * 1.3, x + s * 1.6, y - s * 0.2, x, y + s * 0.9);
      ctx.fill();
    }
  }
  ctx.restore();
}
