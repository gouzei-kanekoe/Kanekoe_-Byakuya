import { Spring, clamp } from "./state.js";
import { LocalTouch, FaceMotion, Blinker } from "./motion.js";
import {
  HAND_ANCHORS,
  SHAPE,
  deformPoint,
  drawAura,
  drawBody,
  drawEmotes,
  drawFace,
  drawHands,
  drawRays,
  handPose,
  insideContour,
  mochiContour,
} from "./byakuya.js";
import { paintBear, paintBoard, paintCushion, random, sparkle } from "./props.js";

class V2 {
  constructor(x = 0, y = 0) {
    this.x = x;
    this.y = y;
  }
  set(x, y) {
    this.x = x;
    this.y = y;
    return this;
  }
  copy(v) {
    return this.set(v.x, v.y);
  }
}
const ease = (dt, rate) => 1 - Math.exp(-dt * rate);
// The held bear sits just below the mouth, in front of Byakuya's lower half.
const BEAR_HELD = { top: 0.22, size: 0.86 };

function makeLayout(w, h) {
  const mobile = w / h < 0.8;
  const r = mobile ? clamp(w * 0.19, 56, 92) : clamp(h * 0.125, 64, 122);
  const floorY = h * (mobile ? 0.65 : 0.69);
  const cushionWidth = r * (mobile ? 2.7 : 2.9);
  const cushion = {
    x: w * (mobile ? 0.3 : 0.33),
    baseY: floorY + h * (mobile ? 0.12 : 0.15),
    width: cushionWidth,
  };
  const home = {
    x: w * (mobile ? 0.6 : 0.57),
    y: floorY - r * (mobile ? 2.05 : 2.2),
  };
  const rand = random(Math.round(w * 7 + h));
  const panels = mobile
    ? [
        { x: w * 0.06, y: h * 0.15, w: w * 0.26, h: h * 0.1, kind: "byakuya" },
        { x: w * 0.7, y: h * 0.17, w: w * 0.22, h: h * 0.09, kind: "bear" },
      ]
    : [
        { x: w * 0.05, y: h * 0.2, w: w * 0.12, h: h * 0.17, kind: "byakuya" },
        { x: w * 0.065, y: h * 0.42, w: w * 0.095, h: h * 0.13, kind: "heart" },
        { x: w * 0.82, y: h * 0.19, w: w * 0.125, h: h * 0.16, kind: "sleepy" },
        { x: w * 0.835, y: h * 0.4, w: w * 0.1, h: h * 0.14, kind: "bear" },
      ];
  const clear = (x, y) =>
    Math.hypot((x - home.x) / (r * 2.4), (y - home.y) / (r * 2)) > 1 &&
    !panels.some((p) => x > p.x - 12 && x < p.x + p.w + 12 && y > p.y - 12 && y < p.y + p.h + 12) &&
    y > (mobile ? 104 : 120) &&
    y < floorY - 16;
  const sparkles = [],
    dots = [];
  for (let tries = 0; sparkles.length < (mobile ? 6 : 11) && tries < 400; tries++) {
    const x = rand() * w,
      y = rand() * floorY;
    if (clear(x, y)) sparkles.push({ x, y, size: 4 + rand() * 6, phase: rand() * 6 });
  }
  for (let tries = 0; dots.length < (mobile ? 10 : 22) && tries < 400; tries++) {
    const x = rand() * w,
      y = rand() * floorY;
    if (clear(x, y)) dots.push({ x, y, r: 1 + rand() * 1.4 });
  }
  return { w, h, mobile, r, floorY, cushion, home, panels, sparkles, dots };
}

export function createRoom(host) {
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D is unavailable");
  canvas.tabIndex = 0;
  canvas.setAttribute(
    "aria-label",
    "白夜。直接碰牠、輕拖局部。Enter 戳戳，方向鍵摸摸，按住空白鍵依偎。",
  );
  canvas.setAttribute("aria-describedby", "hint");
  host.appendChild(canvas);

  let layout,
    dpr = 1,
    board,
    bearArt,
    cushionArt;
  function resize() {
    const w = Math.max(1, host.clientWidth),
      h = Math.max(1, host.clientHeight);
    dpr = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    layout = makeLayout(w, h);
    board = paintBoard(w, h, dpr, layout);
    bearArt = paintBear(layout.r * 1.15, dpr);
    cushionArt = paintCushion(layout.cushion.width, dpr);
  }
  resize();
  const observer = new ResizeObserver(resize);
  observer.observe(host);

  const target = {
    pressure: 0,
    hug: 0,
    touch: new V2(),
    pull: new V2(),
    touch2: new V2(),
    pull2: new V2(),
    contact: false,
  };
  const touchMotion = new LocalTouch(),
    touchMotion2 = new LocalTouch(),
    hugSpring = new Spring(0, 22, 10),
    restSpring = new Spring(0, 14, 8),
    wobble = new Spring(0, 170, 6),
    reach = [new Spring(0, 60, 11), new Spring(0, 60, 11)],
    face = new FaceMotion(),
    blinker = new Blinker(),
    look = new V2(),
    emotes = { surprise: 0, sleep: 0, anger: 0, love: 0 },
    center = new V2(),
    bearPos = new V2(NaN, NaN);
  let lightLevel = 1,
    brightnessLevel = 0.85,
    heldAmount = 0,
    lastPressure = 0,
    scale = 1,
    contour = mochiContour(),
    pose = {},
    lastTime = performance.now(),
    accumulated = 0;

  function canvasPoint(x, y) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((x - rect.left) / rect.width) * layout.w,
      y: ((y - rect.top) / rect.height) * layout.h,
    };
  }
  const radius = () => layout.r * scale;
  function localTouch(x, y) {
    const p = canvasPoint(x, y);
    return new V2((p.x - center.x) / radius(), (p.y - center.y) / radius());
  }
  function hitBody(x, y) {
    const p = localTouch(x, y);
    return insideContour(contour, p.x, p.y, 1.12);
  }
  function dragOffset(startX, startY, x, y) {
    return new V2((x - startX) / radius(), (y - startY) / radius());
  }
  let bearBox = { x: 0, y: 0, w: 0, h: 0 };
  function hitBear(x, y) {
    const p = canvasPoint(x, y),
      pad = layout.mobile ? 6 : 10;
    return (
      Math.hypot(
        (p.x - (bearBox.x + bearBox.w / 2)) / (bearBox.w / 2 + pad),
        (p.y - (bearBox.y + bearBox.h / 2)) / (bearBox.h / 2 + pad),
      ) < 1
    );
  }
  function getScreenAnchor() {
    return { x: center.x + radius() * 0.98, y: center.y - radius() * 1.02 };
  }

  function drawBear(x, y, size, tilt) {
    const w = bearArt.width * (size / bearArt.height),
      h = size;
    bearBox = { x: x - w / 2, y: y - h, w, h };
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(tilt);
    ctx.drawImage(bearArt.canvas, -w / 2, -h, w, h);
    ctx.restore();
  }

  function render(state, time, dt) {
    const { w, h, r, home, cushion, floorY } = layout;
    const still = reducedMotion.matches;
    lightLevel += ((state.lampOn ? 1 : 0) - lightLevel) * ease(dt, 3.5);
    const night = 1 - lightLevel;
    brightnessLevel += (state.brightness - brightnessLevel) * ease(dt, 2.4);
    const brightness = brightnessLevel * (still ? 1 : 1 + Math.sin(time * 1.4) * 0.015);
    const hug = hugSpring.step(dt, target.hug),
      rest = restSpring.step(dt, state.resting && !target.contact ? 1 : 0);
    if (target.pressure >= 0.15 && lastPressure < 0.15 && !still) wobble.velocity += 2.6;
    lastPressure = target.pressure;
    const jiggle = wobble.step(dt, 0);

    // Float in the room, or settle onto the cushion to rest.
    const calm = still ? 0.18 : 1,
      activity = 0.35 + state.energy * 0.65,
      bob = 1 - rest * 0.85;
    scale = 1 + hug * 0.06 - state.upset * 0.05 - rest * 0.16;
    const seat = {
      x: cushion.x + r * 0.08,
      y: cushion.baseY - (cushionArt.baseY - cushionArt.seatY) - SHAPE.bottom * r * scale,
    };
    const touch = target.touch,
      reachDir = Math.hypot(touch.x, touch.y) || 1;
    center.set(
      home.x + (seat.x - home.x) * rest + Math.sin(time * 0.4) * r * 0.1 * calm * bob,
      home.y + (seat.y - home.y) * rest + Math.sin(time * 0.95 * activity) * r * 0.09 * calm * bob,
    );
    center.x += (touch.x / reachDir) * hug * r * 0.12 + state.upset * r * 0.12;
    center.y += (touch.y / reachDir) * hug * r * 0.06;

    const first = touchMotion.step(dt, {
        x: target.pull.x,
        y: target.pull.y,
        pressure: target.pressure,
      }),
      second = touchMotion2.step(dt, { x: target.pull2.x, y: target.pull2.y, pressure: 0 });
    pose = {
      squash: rest * 0.2 + jiggle * 0.12 + state.upset * 0.03,
      breathe: still ? 0 : Math.sin(time * (1.1 + activity * 0.6)),
      touch: target.touch,
      pull: first,
      pressure: first.pressure,
      touch2: target.touch2,
      pull2: second,
      lean: { x: (touch.x / reachDir) * hug, y: (touch.y / reachDir) * hug },
    };
    contour = mochiContour(pose);

    // Eyes follow a nearby hand, otherwise drift around the room.
    const watching = target.contact || target.pressure > 0;
    const lookX = watching ? clamp(touch.x, -1, 1) : Math.sin(time * 0.31) * 0.45 * calm,
      lookY = watching ? clamp(touch.y, -1, 1) : Math.sin(time * 0.23) * 0.25 * calm;
    look.x += (lookX - look.x) * ease(dt, 4);
    look.y += (lookY - look.y) * ease(dt, 4);

    const mood = state.resting && state.upset < 0.25 ? "tired" : state.mood;
    const features = face.step(dt, mood);
    const blink = still ? 0 : blinker.step(dt);
    for (const [key, on] of [
      ["surprise", mood === "surprised"],
      ["sleep", state.resting || mood === "tired"],
      ["anger", mood === "annoyed"],
      ["love", hug > 0.6],
    ])
      emotes[key] += ((on ? 1 : 0) - emotes[key]) * ease(dt, on ? 6 : 3);

    // The bear glides between the cushion and Byakuya's arms.
    heldAmount += ((state.hasBear ? 1 : 0) - heldAmount) * ease(dt, 2.6);
    const held = {
      x: center.x,
      y: center.y + (BEAR_HELD.top + BEAR_HELD.size) * radius(),
    };
    const onCushion = {
      // Scoot aside when Byakuya is the one resting on the cushion.
      x: cushion.x - rest * cushion.width * 0.32,
      y: cushion.baseY - (cushionArt.baseY - cushionArt.seatY) + r * 0.08,
    };
    const bearGoal = state.hasBear ? held : onCushion;
    if (Number.isNaN(bearPos.x)) bearPos.copy(bearGoal);
    const follow = ease(dt, state.hasBear && heldAmount > 0.7 ? 14 : 2.6);
    bearPos.x += (bearGoal.x - bearPos.x) * follow;
    bearPos.y += (bearGoal.y - bearPos.y) * follow;
    const bearSize = r * 1.15 + (radius() * BEAR_HELD.size - r * 1.15) * heldAmount,
      bearTilt = heldAmount * (still ? 0 : Math.sin(time * 0.9) * 0.05);

    // Little hands of light peek out to hold the bear, or to cuddle.
    const bearWidth = bearArt.width * (bearSize / bearArt.height),
      gripY = (bearPos.y - bearSize + bearArt.grip.y * bearSize - center.y) / radius();
    const cuddling = hug > 0.35 && !state.hasBear,
      touchDistance = Math.hypot(touch.x, touch.y);
    const hands = HAND_ANCHORS.map((base, i) => {
      const side = i ? 1 : -1;
      // Paws hold the sides of the bear's chest, rooted just inside the body.
      const grip = {
        x: (bearPos.x - center.x + ((i ? bearArt.grip.right : bearArt.grip.left) - 0.5) * bearWidth) / radius() + side * 0.04,
        y: gripY,
      };
      const root = { x: grip.x + side * 0.05, y: grip.y - 0.11 };
      const anchor = deformPoint(
        {
          x: base.x + (root.x - base.x) * heldAmount,
          y: base.y + (root.y - base.y) * heldAmount,
        },
        pose,
      );
      let goal;
      if (state.hasBear) goal = grip;
      else if (side * touch.x > 0.2 && touchDistance > 0.72) {
        // A hand near the edge gets held by the little paw on that side.
        goal = { x: touch.x, y: touch.y };
      } else {
        // Otherwise both paws peek out and wave a little, happily.
        const wave = still ? 0 : Math.sin(time * 4.2 + i * 1.7) * 0.04;
        goal = { x: anchor.x + side * 0.13, y: anchor.y - 0.09 + wave };
      }
      const want = state.hasBear ? (heldAmount > 0.7 ? 1 : 0) : cuddling ? 1 : 0;
      return { anchor, ...handPose(anchor, goal, reach[i].step(dt, want)) };
    });

    const R = radius(),
      glow = clamp(brightness, 0.25, 1),
      view = {
        x: center.x,
        y: center.y,
        r: R,
        dpr,
        glow,
        night,
        time,
        still,
        look,
        blink,
        dim: clamp((0.55 - brightness) * 2, 0, 1),
        happy: ["happy", "excited", "squeezed"].includes(mood) ? 1 : 0,
      };

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.drawImage(board, 0, 0, w, h);
    if (!still)
      for (const s of layout.sparkles.slice(0, 4)) {
        const a = 0.5 + 0.5 * Math.sin(time * 1.3 + s.phase);
        ctx.fillStyle = `rgba(245,248,255,${0.25 * a})`;
        sparkle(ctx, s.x, s.y, s.size * (1.2 + a * 0.3));
        ctx.fill();
      }

    // Pool of light on the floor below.
    const poolY = floorY + h * 0.07 + (cushion.baseY - r * 0.25 - floorY - h * 0.07) * rest;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.translate(center.x, poolY);
    ctx.scale(1, 0.24);
    const pool = ctx.createRadialGradient(0, 0, 0, 0, 0, R * 2.8);
    pool.addColorStop(0, `rgba(205,220,255,${0.2 * glow * (0.6 + night * 0.9)})`);
    pool.addColorStop(1, "rgba(205,220,255,0)");
    ctx.fillStyle = pool;
    ctx.fillRect(-R * 3, -R * 3, R * 6, R * 6);
    ctx.restore();

    const cw = cushionArt.width;
    ctx.drawImage(
      cushionArt.canvas,
      cushion.x - cw / 2,
      cushion.baseY - cushionArt.baseY,
      cw,
      cushionArt.height,
    );

    const bearInFront = heldAmount > 0.5;
    if (!bearInFront) drawBear(bearPos.x, bearPos.y, bearSize, bearTilt);

    if (night > 0.01) {
      // Darkness everywhere except where Byakuya's light reaches.
      const outer = R * (4.2 + glow * 2.2);
      const dark = ctx.createRadialGradient(center.x, center.y, R * 0.8, center.x, center.y, outer);
      dark.addColorStop(0, "rgba(9,12,28,0)");
      dark.addColorStop(0.35, `rgba(9,12,28,${0.28 * night})`);
      dark.addColorStop(1, `rgba(9,12,28,${0.68 * night})`);
      ctx.fillStyle = dark;
      ctx.fillRect(0, 0, w, h);
    }

    drawAura(ctx, view);
    drawRays(ctx, contour, view);
    drawBody(ctx, contour, view);
    drawFace(ctx, features, pose, view);
    if (bearInFront) drawBear(bearPos.x, bearPos.y, bearSize, bearTilt);
    drawHands(ctx, hands, view);
    drawEmotes(ctx, emotes, view);

    // Visible state also supports accessible descriptions and local interaction QA.
    host.dataset.cuddle = hug.toFixed(3);
    host.dataset.deformation = Math.hypot(first.x, first.y).toFixed(3);
    host.dataset.resting = String(state.resting);
    host.dataset.face = face.features.map((v) => v.toFixed(3)).join(",");
    host.dataset.hands = hands.map((hand) => hand.reach.toFixed(3)).join(",");
    host.dataset.centerX = center.x.toFixed(1);
    host.dataset.centerY = center.y.toFixed(1);
  }

  function animate(step) {
    let frame;
    function next(now) {
      const dt = Math.min(0.05, Math.max(0, (now - lastTime) / 1000));
      lastTime = now;
      if (!document.hidden) {
        accumulated += dt;
        step(dt, accumulated);
      }
      frame = requestAnimationFrame(next);
    }
    frame = requestAnimationFrame(next);
    const visibility = () => {
      lastTime = performance.now();
    };
    document.addEventListener("visibilitychange", visibility);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      document.removeEventListener("visibilitychange", visibility);
      canvas.remove();
    };
  }

  return {
    canvas,
    target,
    hitBody,
    hitBear,
    localTouch,
    dragOffset,
    getScreenAnchor,
    render,
    animate,
    reducedMotion,
  };
}
