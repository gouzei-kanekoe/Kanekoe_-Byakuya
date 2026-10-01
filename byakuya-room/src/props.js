// Hand-drawn props, painted once per layout into offscreen canvases.
const TAU = Math.PI * 2;
const LINE = "#2d2730";

export function random(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function surface(width, height, dpr) {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.ceil(width * dpr));
  canvas.height = Math.max(1, Math.ceil(height * dpr));
  const ctx = canvas.getContext("2d");
  ctx.scale(dpr, dpr);
  return { canvas, ctx };
}

// A closed curve through slightly uneven points, like a marker line.
function wobblyEllipse(ctx, cx, cy, rx, ry, rotation, rand, amount = 0.025) {
  const n = 22,
    pts = [];
  const c = Math.cos(rotation),
    s = Math.sin(rotation);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU,
      k = 1 + (rand() - 0.5) * amount,
      x = Math.cos(a) * rx * k,
      y = Math.sin(a) * ry * k;
    pts.push([cx + x * c - y * s, cy + x * s + y * c]);
  }
  ctx.beginPath();
  const mid = (i) => [
    (pts[i % n][0] + pts[(i + 1) % n][0]) / 2,
    (pts[i % n][1] + pts[(i + 1) % n][1]) / 2,
  ];
  ctx.moveTo(...mid(n - 1));
  for (let i = 0; i < n; i++) ctx.quadraticCurveTo(...pts[i], ...mid(i));
  ctx.closePath();
}

function blob(ctx, cx, cy, rx, ry, rotation, fill, rand, line = 2.4) {
  wobblyEllipse(ctx, cx, cy, rx, ry, rotation, rand);
  ctx.fillStyle = fill;
  ctx.fill();
  if (line) {
    ctx.lineWidth = line;
    ctx.strokeStyle = LINE;
    ctx.stroke();
  }
}

// Marker-on-paper texture: uneven pigment that stays inside painted areas.
function watercolor(ctx, x, y, w, h, rand, tones, count) {
  ctx.save();
  ctx.globalCompositeOperation = "source-atop";
  for (let i = 0; i < count; i++) {
    const cx = x + rand() * w,
      cy = y + rand() * h,
      r = (0.08 + rand() * 0.22) * Math.max(w, h),
      tone = tones[Math.floor(rand() * tones.length)];
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    g.addColorStop(0, tone);
    g.addColorStop(1, tone.replace(/[\d.]+\)$/, "0)"));
    ctx.fillStyle = g;
    ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
  }
  ctx.restore();
}

// 小小熊, after the little bear in #27: chubby, round ears, pink cheeks.
export function paintBear(height, dpr) {
  const scale = height / 124,
    pad = 4;
  const { canvas, ctx } = surface(100 * scale + pad * 2, height + pad * 2, dpr);
  ctx.translate(pad, pad);
  ctx.scale(scale, scale);
  ctx.lineJoin = ctx.lineCap = "round";
  const rand = random(27),
    fur = "#9c7857",
    light = "#dcc3a0";
  for (const side of [-1, 1]) {
    blob(ctx, 50 + side * 25, 22, 13, 13, 0, fur, rand);
    blob(ctx, 50 + side * 23.5, 24, 7, 6.5, 0, "#e7a45e", rand, 0);
  }
  blob(ctx, 50, 88, 30, 28, 0, fur, rand);
  blob(ctx, 50, 91, 15, 14, 0, "#b48f6a", rand, 0);
  for (const side of [-1, 1]) {
    blob(ctx, 50 + side * 16, 112, 13, 10, side * 0.12, fur, rand);
    blob(ctx, 50 + side * 16, 114, 6, 4.5, 0, light, rand, 0);
    blob(ctx, 50 + side * 29, 82, 10, 14, side * -0.55, fur, rand);
  }
  blob(ctx, 50, 46, 34, 29, 0, fur, rand);
  blob(ctx, 50, 56, 12.5, 9, 0, light, rand, 1.6);
  ctx.fillStyle = LINE;
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.arc(50 + side * 13, 44, 2.9, 0, TAU);
    ctx.fill();
  }
  ctx.fillStyle = "#ffffff";
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.arc(50 + side * 13 + 1, 43, 0.9, 0, TAU);
    ctx.fill();
  }
  ctx.fillStyle = "rgba(240,150,150,0.85)";
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(50 + side * 22, 55, 5.5, 3.8, 0, 0, TAU);
    ctx.fill();
  }
  ctx.fillStyle = "#3a2b28";
  ctx.beginPath();
  ctx.ellipse(50, 52, 4.4, 3.1, 0, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = "#3a2b28";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(50, 54.5);
  ctx.lineTo(50, 57.5);
  ctx.moveTo(45.5, 58);
  ctx.quadraticCurveTo(47.8, 61, 50, 57.5);
  ctx.quadraticCurveTo(52.2, 61, 54.5, 58);
  ctx.stroke();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  watercolor(
    ctx,
    0,
    0,
    canvas.width,
    canvas.height,
    rand,
    ["rgba(70,45,30,0.12)", "rgba(255,240,215,0.12)", "rgba(120,80,50,0.1)"],
    26,
  );
  return { canvas, width: 100 * scale + pad * 2, height: height + pad * 2, pad };
}

// Rounded quadrilateral with softly puffed edges.
function cushionPath(ctx, corners, round, puff, dy = 0) {
  const n = corners.length,
    pt = (i) => corners[(i + n) % n];
  const towards = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t + dy];
  ctx.beginPath();
  for (let i = 0; i < n; i++) {
    const p = pt(i),
      prev = pt(i - 1),
      next = pt(i + 1);
    const a = towards(p, prev, round / Math.hypot(prev[0] - p[0], prev[1] - p[1])),
      b = towards(p, next, round / Math.hypot(next[0] - p[0], next[1] - p[1]));
    if (i === 0) ctx.moveTo(...a);
    else {
      // Puff the edge outwards between corners.
      const ex = p[0] - prev[0],
        ey = p[1] - prev[1],
        len = Math.hypot(ex, ey),
        mx = (prev[0] + p[0]) / 2 + (ey / len) * puff,
        my = (prev[1] + p[1]) / 2 - (ex / len) * puff + dy;
      ctx.quadraticCurveTo(mx, my, ...a);
    }
    ctx.quadraticCurveTo(p[0], p[1] + dy, ...b);
  }
  const p = pt(0),
    prev = pt(-1),
    ex = p[0] - prev[0],
    ey = p[1] - prev[1],
    len = Math.hypot(ex, ey);
  const a = towards(p, prev, round / len);
  ctx.quadraticCurveTo(
    (prev[0] + p[0]) / 2 + (ey / len) * puff,
    (prev[1] + p[1]) / 2 - (ex / len) * puff + dy,
    ...a,
  );
  ctx.closePath();
}

// A wide, puffy square floor cushion seen slightly from above.
export function paintCushion(width, dpr) {
  const scale = width / 300,
    pad = 4,
    h = 140 * scale;
  const { canvas, ctx } = surface(width + pad * 2, h + pad * 2, dpr);
  ctx.translate(pad, pad);
  ctx.scale(scale, scale);
  ctx.lineJoin = ctx.lineCap = "round";
  const rand = random(8);
  const shadow = ctx.createRadialGradient(150, 122, 0, 150, 122, 155);
  shadow.addColorStop(0, "rgba(12,16,32,0.45)");
  shadow.addColorStop(1, "rgba(12,16,32,0)");
  ctx.save();
  ctx.translate(0, 122);
  ctx.scale(1, 0.13);
  ctx.translate(0, -122);
  ctx.fillStyle = shadow;
  ctx.fillRect(-10, -40, 320, 330);
  ctx.restore();
  // Corners clockwise from back-left; the front edge is closer, so wider.
  const corners = [
      [34, 16],
      [266, 16],
      [292, 84],
      [8, 84],
    ],
    thick = 26,
    round = 26,
    puff = 3.5;
  // Extrude the top face downwards: strokes first, then fills, leave only the silhouette line.
  ctx.strokeStyle = LINE;
  ctx.lineWidth = 5.2;
  for (let dy = thick; dy >= 0; dy -= 1) {
    cushionPath(ctx, corners, round, puff, dy);
    ctx.stroke();
  }
  for (let dy = thick; dy > 0; dy -= 1) {
    cushionPath(ctx, corners, round, puff, dy);
    ctx.fillStyle = dy > thick * 0.6 ? "#727683" : "#7e828e";
    ctx.fill();
  }
  ctx.lineWidth = 2.6;
  cushionPath(ctx, corners, round, puff);
  const dome = ctx.createRadialGradient(150, 46, 8, 150, 52, 150);
  dome.addColorStop(0, "#c3c6cf");
  dome.addColorStop(0.5, "#abafba");
  dome.addColorStop(1, "#959aa6");
  ctx.fillStyle = dome;
  ctx.fill();
  ctx.stroke();
  // Stitched seam, centre tuft and little corner tassels.
  ctx.save();
  ctx.translate(150, 50);
  ctx.scale(0.84, 0.76);
  ctx.translate(-150, -50);
  cushionPath(ctx, corners, round, puff);
  ctx.restore();
  ctx.setLineDash([7, 7]);
  ctx.lineWidth = 1.6;
  ctx.strokeStyle = "rgba(88,92,106,0.65)";
  ctx.stroke();
  ctx.setLineDash([]);
  const dimple = ctx.createRadialGradient(150, 50, 0, 150, 50, 24);
  dimple.addColorStop(0, "rgba(70,74,88,0.35)");
  dimple.addColorStop(1, "rgba(70,74,88,0)");
  ctx.fillStyle = dimple;
  ctx.beginPath();
  ctx.ellipse(150, 50, 28, 12, 0, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = "#5d616e";
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.moveTo(145, 47);
  ctx.lineTo(155, 53);
  ctx.moveTo(155, 47);
  ctx.lineTo(145, 53);
  ctx.stroke();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  watercolor(
    ctx,
    0,
    0,
    canvas.width,
    canvas.height * 0.85,
    rand,
    ["rgba(40,46,66,0.1)", "rgba(240,242,250,0.1)", "rgba(110,116,140,0.1)"],
    30,
  );
  return {
    canvas,
    width: width + pad * 2,
    height: h + pad * 2,
    pad,
    seatY: 52 * scale + pad,
    baseY: 122 * scale + pad,
  };
}

function chalkLine(ctx, points, rand, alpha = 0.55, width = 1.6) {
  for (let pass = 0; pass < 2; pass++) {
    ctx.strokeStyle = `rgba(238,242,255,${alpha * (pass ? 0.45 : 1)})`;
    ctx.lineWidth = width * (pass ? 1.8 : 1);
    ctx.beginPath();
    points.forEach(([x, y], i) => {
      const jx = (rand() - 0.5) * 1.6,
        jy = (rand() - 0.5) * 1.6;
      i ? ctx.lineTo(x + jx, y + jy) : ctx.moveTo(x + jx, y + jy);
    });
    ctx.stroke();
  }
}

export function sparkle(ctx, x, y, size) {
  ctx.beginPath();
  ctx.moveTo(x, y - size);
  ctx.quadraticCurveTo(x + size * 0.12, y - size * 0.12, x + size, y);
  ctx.quadraticCurveTo(x + size * 0.12, y + size * 0.12, x, y + size);
  ctx.quadraticCurveTo(x - size * 0.12, y + size * 0.12, x - size, y);
  ctx.quadraticCurveTo(x - size * 0.12, y - size * 0.12, x, y - size);
}

function chalkPanel(ctx, x, y, w, h, rand) {
  const wob = () => (rand() - 0.5) * 3;
  chalkLine(ctx, [[x + wob(), y], [x + w, y + wob()], [x + w + wob(), y + h], [x, y + h + wob()], [x + wob(), y]], rand);
}

function miniByakuya(ctx, cx, cy, s, rand, sleepy = false) {
  ctx.lineCap = "round";
  for (let i = 0; i < 11; i++) {
    const a = -Math.PI * 0.95 + (i / 10) * Math.PI * 1.9 + (rand() - 0.5) * 0.15,
      r0 = s * (1.05 + rand() * 0.15),
      r1 = r0 + s * (0.18 + rand() * 0.12);
    if (Math.sin(a) > 0.55) continue;
    chalkLine(ctx, [[cx + Math.cos(a) * r0, cy + Math.sin(a) * r0 * 0.8], [cx + Math.cos(a) * r1, cy + Math.sin(a) * r1 * 0.8]], rand, 0.6, 1.4);
  }
  ctx.fillStyle = "rgba(238,242,255,0.6)";
  for (const side of [-1, 1]) {
    if (sleepy)
      chalkLine(ctx, [[cx + side * s * 0.42 - s * 0.1, cy], [cx + side * s * 0.42, cy + s * 0.07], [cx + side * s * 0.42 + s * 0.1, cy]], rand, 0.6, 1.3);
    else {
      ctx.beginPath();
      ctx.arc(cx + side * s * 0.4, cy, Math.max(1.4, s * 0.07), 0, TAU);
      ctx.fill();
    }
  }
  chalkLine(ctx, [[cx - s * 0.12, cy + s * 0.2], [cx - s * 0.05, cy + s * 0.27], [cx, cy + s * 0.22], [cx + s * 0.05, cy + s * 0.27], [cx + s * 0.12, cy + s * 0.2]], rand, 0.6, 1.3);
}

function miniBear(ctx, cx, cy, s, rand) {
  const ring = (x, y, rx, ry) => {
    const pts = [];
    for (let i = 0; i <= 18; i++) {
      const a = (i / 18) * TAU;
      pts.push([x + Math.cos(a) * rx, y + Math.sin(a) * ry]);
    }
    chalkLine(ctx, pts, rand, 0.55, 1.4);
  };
  ring(cx - s * 0.72, cy - s * 0.72, s * 0.3, s * 0.3);
  ring(cx + s * 0.72, cy - s * 0.72, s * 0.3, s * 0.3);
  ring(cx, cy, s, s * 0.84);
  ring(cx, cy + s * 0.25, s * 0.3, s * 0.22);
  ctx.fillStyle = "rgba(238,242,255,0.6)";
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.arc(cx + side * s * 0.38, cy - s * 0.1, Math.max(1.3, s * 0.07), 0, TAU);
    ctx.fill();
  }
}

function heart(ctx, x, y, s, rand) {
  const pts = [];
  for (let i = 0; i <= 24; i++) {
    const t = (i / 24) * TAU;
    pts.push([
      x + s * 0.06 * 16 * Math.sin(t) ** 3,
      y - s * 0.06 * (13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)),
    ]);
  }
  chalkLine(ctx, pts, rand, 0.5, 1.4);
}

// Navy chalkboard wall with doodles, like the #26 / #27 end cards.
export function paintBoard(width, height, dpr, layout) {
  const { canvas, ctx } = surface(width, height, dpr);
  const rand = random(2810),
    floor = layout.floorY;
  const wall = ctx.createLinearGradient(0, 0, 0, floor);
  wall.addColorStop(0, "#5a698c");
  wall.addColorStop(1, "#4e5b7d");
  ctx.fillStyle = wall;
  ctx.fillRect(0, 0, width, floor);
  const ground = ctx.createLinearGradient(0, floor, 0, height);
  ground.addColorStop(0, "#414b68");
  ground.addColorStop(1, "#384260");
  ctx.fillStyle = ground;
  ctx.fillRect(0, floor, width, height - floor);
  // Watercolour mottling.
  const blotches = Math.round((width * height) / 7000);
  for (let i = 0; i < blotches; i++) {
    const x = rand() * width,
      y = rand() * height,
      r = 25 + rand() * 140,
      tone = rand() < 0.55 ? "28,36,62" : "128,145,186";
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(${tone},${0.035 + rand() * 0.05})`);
    g.addColorStop(1, `rgba(${tone},0)`);
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  // Chalk dust.
  const dust = Math.round((width * height) / 90);
  for (let i = 0; i < dust; i++) {
    ctx.fillStyle = `rgba(235,240,255,${0.015 + rand() * 0.05})`;
    ctx.fillRect(rand() * width, rand() * height, 1 + rand(), 1);
  }
  // Ink line where wall meets floor.
  ctx.strokeStyle = "rgba(30,34,48,0.75)";
  ctx.lineWidth = 2.4;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(-10, floor);
  for (let x = 30; x < width + 50; x += 40) ctx.lineTo(x, floor + (rand() - 0.5) * 1.5);
  ctx.stroke();
  // Doodle panels and sparkles, kept clear of the middle of the room.
  for (const p of layout.panels) {
    chalkPanel(ctx, p.x, p.y, p.w, p.h, rand);
    const cx = p.x + p.w / 2,
      cy = p.y + p.h / 2,
      s = Math.min(p.w, p.h) * 0.24;
    if (p.kind === "byakuya") miniByakuya(ctx, cx, cy + s * 0.15, s, rand);
    if (p.kind === "sleepy") {
      miniByakuya(ctx, cx - s * 0.2, cy + s * 0.2, s * 0.9, rand, true);
      chalkLine(ctx, [[cx + s * 1.0, cy - s * 0.9], [cx + s * 1.3, cy - s * 0.9], [cx + s * 1.0, cy - s * 0.6], [cx + s * 1.3, cy - s * 0.6]], rand, 0.55, 1.3);
    }
    if (p.kind === "bear") miniBear(ctx, cx, cy + s * 0.15, s * 0.95, rand);
    if (p.kind === "heart") {
      heart(ctx, cx - s * 0.5, cy, s * 0.9, rand);
      heart(ctx, cx + s * 0.6, cy - s * 0.5, s * 0.55, rand);
    }
  }
  ctx.fillStyle = "rgba(238,242,255,0.55)";
  for (const s of layout.sparkles) {
    sparkle(ctx, s.x, s.y, s.size);
    ctx.fill();
  }
  ctx.fillStyle = "rgba(238,242,255,0.35)";
  for (let i = 0; i < layout.dots.length; i++) {
    const d = layout.dots[i];
    ctx.beginPath();
    ctx.arc(d.x, d.y, d.r, 0, TAU);
    ctx.fill();
  }
  return canvas;
}
