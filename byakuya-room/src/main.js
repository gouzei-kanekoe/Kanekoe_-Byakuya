import "./style.css";
import { ByakuyaState, clamp } from "./state.js";
import { boundedPull, CompanionContact } from "./motion.js";
import { createRoom } from "./scene.js";
import { registerRoomTools } from "./webmcp.js";

const $ = (selector) => document.querySelector(selector),
  state = new ByakuyaState(),
  host = $("#scene");
const moodDescriptions = {
  idle: "安安靜靜地飄著",
  happy: "被摸摸了，有點開心",
  excited: "今天很有精神呢",
  surprised: "咦？剛剛是你嗎？",
  squeezed: "軟軟的，慢慢恢復",
  annoyed: "白夜皺起了眉頭",
  sad: "想安靜待一會",
  tired: "有點累了，想休息一下",
};
let room,
  thoughtUntil = 0,
  lastThought = -20,
  lastIdleThought = 0,
  lastMood = "",
  lastBear = null,
  lastPet = -1,
  remoteHugUntil = 0,
  pokeUntil = 0,
  hover = null,
  keyContact = false,
  cuddled = false;
const gestures = new Map(),
  contact = new CompanionContact(),
  listeners = new AbortController();
function think(text, duration = 4) {
  $("#thought-text").textContent = text;
  $("#thought").classList.add("visible");
  thoughtUntil = state.time + duration;
  lastThought = state.time;
}
function interact(kind, strength = 1) {
  state.interact(kind, strength);
  if (kind === "poke") {
    pokeUntil = state.time + 0.25;
    room.target.pressure = 0.15;
  }
  if (kind === "pet" && state.time - lastThought > 12 && state.upset < 0.3)
    think("再摸摸……", 2.5);
}
function setLight(on) {
  const upset = state.setLamp(on);
  document.body.classList.toggle("night", !state.lampOn);
  $("#lamp").setAttribute("aria-pressed", String(state.lampOn));
  $("#lamp").setAttribute("aria-label", state.lampOn ? "關燈" : "開燈");
  $("#lamp-label").textContent = state.lampOn ? "關燈" : "開燈";
  $(".lamp-icon").textContent = state.lampOn ? "☼" : "☾";
  if (upset) think("不要一直開開關關……", 5);
}
function refreshBear() {
  if (lastBear === state.hasBear) return;
  lastBear = state.hasBear;
  $("#bear").setAttribute("aria-pressed", String(state.hasBear));
  $("#bear").innerHTML = state.hasBear
    ? '<span aria-hidden="true">ʕ•ᴥ•ʔ</span>放下熊'
    : '<span aria-hidden="true">ʕ•ᴥ•ʔ</span>小小熊';
  $("#bear").setAttribute(
    "aria-label",
    state.hasBear ? "讓小小熊在坐墊上休息" : "把小小熊交給白夜抱著",
  );
}
function setBear(held) {
  state.setBear(held);
  refreshBear();
  if (held) think("小小熊……", 3);
}
function resetContact() {
  const ids = [...gestures.keys()];
  gestures.clear();
  hover = null;
  keyContact = false;
  contact.calmFor = 0;
  cuddled = false;
  if (!room) return;
  room.target.pull.set(0, 0);
  room.target.pull2.set(0, 0);
  room.target.pressure = 0;
  room.target.contact = false;
  room.target.hug = 0;
  for (const id of ids) {
    try {
      room.renderer.domElement.releasePointerCapture(id);
    } catch {}
  }
}
function pointerDown(e) {
  if (e.pointerType === "mouse" && e.button !== 0) return;
  if (!room.hitBody(e.clientX, e.clientY)) {
    if (!gestures.size && room.hitBear(e.clientX, e.clientY))
      setBear(!state.hasBear);
    return;
  }
  if (gestures.size >= 2) return;
  e.preventDefault();
  const canvas = room.renderer.domElement;
  canvas.setPointerCapture(e.pointerId);
  const slot = [...gestures.values()].some((g) => g.slot === 0) ? 1 : 0;
  gestures.set(e.pointerId, {
    slot,
    start: state.time,
    x: e.clientX,
    y: e.clientY,
    lastX: e.clientX,
    lastY: e.clientY,
    distance: 0,
    pull: 0,
    lastReaction: state.time,
    sign: 0,
    reversals: 0,
  });
  (slot === 0 ? room.target.touch : room.target.touch2).copy(
    room.localTouch(e.clientX, e.clientY),
  );
  room.target.pressure = 0.07;
  room.target.contact = true;
  host.style.cursor = "grabbing";
  state.resting = false;
  state.lastInteraction = state.time;
  state.nextRestAt = state.time + 40;
}
function pointerMove(e) {
  const g = gestures.get(e.pointerId);
  if (!g) {
    const hit = room.hitBody(e.clientX, e.clientY);
    host.style.cursor = hit
      ? "grab"
      : room.hitBear(e.clientX, e.clientY)
        ? "pointer"
        : "default";
    if (e.pointerType === "mouse" && !gestures.size && e.buttons === 0 && hit) {
      const moved = hover
        ? Math.hypot(e.clientX - hover.x, e.clientY - hover.y)
        : 0;
      hover = { x: e.clientX, y: e.clientY };
      room.target.touch.copy(room.localTouch(e.clientX, e.clientY));
      if (moved > 2 && state.time - lastPet > 0.65) {
        interact("pet", 0.3);
        lastPet = state.time;
      }
    } else if (!gestures.size) hover = null;
    return;
  }
  e.preventDefault();
  const dx = e.clientX - g.lastX,
    dy = e.clientY - g.lastY;
  g.distance += Math.hypot(dx, dy);
  g.lastX = e.clientX;
  g.lastY = e.clientY;
  const delta = room.dragOffset(g.x, g.y, e.clientX, e.clientY),
    pull = boundedPull(delta.x, delta.y);
  (g.slot === 0 ? room.target.pull : room.target.pull2).set(pull.x, pull.y);
  g.pull = Math.hypot(pull.x, pull.y);
  const sign = Math.sign(Math.abs(dx) > Math.abs(dy) ? dx : dy);
  if (sign && g.sign && sign !== g.sign && Math.hypot(dx, dy) > 2)
    g.reversals++;
  if (sign) g.sign = sign;
  if (state.time - g.lastReaction > 0.65 && g.distance > 10) {
    interact(
      g.pull > 0.22 ? "stretch" : g.reversals >= 3 ? "rub" : "pet",
      g.pull > 0.22 ? 0.35 : 0.45,
    );
    g.lastReaction = state.time;
  }
}
function pointerUp(e) {
  const g = gestures.get(e.pointerId);
  if (!g) return;
  if (e.type !== "pointercancel") {
    if (g.distance < 10 && state.time - g.start < 0.4) interact("poke");
    else if (state.time - g.lastReaction > 0.6)
      interact(g.pull > 0.22 ? "stretch" : "pet", 0.4);
  }
  gestures.delete(e.pointerId);
  (g.slot === 0 ? room.target.pull : room.target.pull2).set(0, 0);
  try {
    room.renderer.domElement.releasePointerCapture(e.pointerId);
  } catch {}
  if (!gestures.size) {
    room.target.pressure = state.time < pokeUntil ? 0.15 : 0;
    room.target.contact = false;
    contact.calmFor = 0;
    cuddled = false;
    hover =
      e.pointerType === "mouse" && room.hitBody(e.clientX, e.clientY)
        ? { x: e.clientX, y: e.clientY }
        : null;
    host.style.cursor = "grab";
  }
}
function refreshUI() {
  const close = Number(host.dataset.cuddle) > 0.55;
  const text = state.resting
    ? "抱著小小熊，在坐墊上歇一會"
    : close
      ? "白夜輕輕靠過來，依偎著你"
      : moodDescriptions[state.mood];
  if (lastMood !== text) {
    $("#mood").textContent = text;
    host.dataset.mood = state.mood;
    lastMood = text;
  }
  host.dataset.energy = state.energy.toFixed(3);
  host.dataset.lamp = String(state.lampOn);
  host.dataset.bear = String(state.hasBear);
  refreshBear();
  if (state.time > thoughtUntil) $("#thought").classList.remove("visible");
  const anchor = room.getScreenAnchor(),
    bubble = $("#thought");
  bubble.style.left = `${clamp(anchor.x, 22, Math.max(22, host.clientWidth - bubble.offsetWidth - 22))}px`;
  bubble.style.top = `${clamp(anchor.y - 30, 120, host.clientHeight - 170)}px`;
  if (
    state.time - lastIdleThought > 28 &&
    state.time - state.lastInteraction > 10 &&
    state.time - lastThought > 12
  ) {
    lastIdleThought = state.time;
    const thoughts =
      state.resting || state.mood === "tired"
        ? ["想休息一下……", "小小熊，在這裡就好。"]
        : state.upset > 0.25
          ? ["想安靜待一會……"]
          : ["2810回來了沒有呢……", "想出去玩……", "這裡好安靜。"];
    think(thoughts[Math.floor(state.time / 28) % thoughts.length], 4.5);
  }
}
$("#lamp").addEventListener("click", () => setLight(!state.lampOn), {
  signal: listeners.signal,
});
$("#bear").addEventListener("click", () => setBear(!state.hasBear), {
  signal: listeners.signal,
});
try {
  room = createRoom(host);
  const canvas = room.renderer.domElement;
  for (const [event, fn] of [
    ["pointerdown", pointerDown],
    ["pointermove", pointerMove],
    ["pointerup", pointerUp],
    ["pointercancel", pointerUp],
  ])
    canvas.addEventListener(event, fn, { signal: listeners.signal });
  canvas.addEventListener(
    "pointerleave",
    () => {
      if (!gestures.size) hover = null;
    },
    { signal: listeners.signal },
  );
  canvas.addEventListener(
    "lostpointercapture",
    (e) => {
      if (gestures.has(e.pointerId)) resetContact();
    },
    { signal: listeners.signal },
  );
  canvas.addEventListener(
    "keydown",
    (e) => {
      if (e.key === "Enter" && !e.repeat) {
        interact("poke");
        e.preventDefault();
      }
      if (e.code === "Space") {
        keyContact = true;
        e.preventDefault();
      }
      if (e.key.startsWith("Arrow")) {
        interact("pet", 0.5);
        keyContact = true;
        e.preventDefault();
      }
    },
    { signal: listeners.signal },
  );
  canvas.addEventListener(
    "keyup",
    (e) => {
      if (e.code === "Space" || e.key.startsWith("Arrow")) {
        keyContact = false;
        contact.calmFor = 0;
        e.preventDefault();
      }
    },
    { signal: listeners.signal },
  );
  canvas.addEventListener("blur", resetContact, { signal: listeners.signal });
  addEventListener("blur", resetContact, { signal: listeners.signal });
  document.addEventListener(
    "visibilitychange",
    () => {
      if (document.hidden) resetContact();
    },
    { signal: listeners.signal },
  );
  const dispose = room.animate((dt, time) => {
    const hovering = hover && room.hitBody(hover.x, hover.y),
      touching = gestures.size > 0 || hovering || keyContact;
    const pull = Math.max(...[...gestures.values()].map((g) => g.pull), 0);
    room.target.contact = Boolean(touching);
    const cuddle = contact.step(dt, touching, pull, state.upset > 0.62);
    if (touching && pull < 0.22 && state.time - lastPet > 0.8) {
      interact("pet", 0.25);
      lastPet = state.time;
    }
    if (cuddle > 0.65 && !cuddled) {
      state.interact("hug", 0.5);
      cuddled = true;
      if (state.time - lastThought > 8) think("暖暖的。", 3);
    }
    if (!touching || cuddle === 0) cuddled = false;
    room.target.hug = Math.max(cuddle, state.time < remoteHugUntil ? 1 : 0);
    if (!gestures.size)
      room.target.pressure =
        state.time < pokeUntil ? 0.15 : hovering ? 0.018 : 0;
    state.step(dt);
    room.render(state, time, dt);
    refreshUI();
  });
  const redraw = () => {
    room.render(state, state.time, 0.016);
    refreshUI();
  };
  const unregister = registerRoomTools({
    read: () => state.snapshot(),
    pet: () => {
      interact("pet");
      redraw();
    },
    hug: () => {
      state.interact("hug");
      remoteHugUntil = state.time + 3;
      redraw();
    },
    lamp: (on) => {
      setLight(on);
      redraw();
    },
    bear: (held) => {
      setBear(held);
      redraw();
    },
  });
  requestAnimationFrame(() => {
    $("#loading").classList.add("ready");
    setTimeout(() => {
      $("#loading").hidden = true;
    }, 700);
  });
  if (import.meta.hot)
    import.meta.hot.dispose(() => {
      unregister();
      listeners.abort();
      dispose();
    });
} catch (error) {
  console.error("白夜的房間無法顯示：", error);
  $("#loading").hidden = true;
  $("#fallback").hidden = false;
  for (const b of document.querySelectorAll("button")) b.disabled = true;
}
