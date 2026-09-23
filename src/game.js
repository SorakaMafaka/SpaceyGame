import {
  createExpedition,
  updateExpedition,
  expeditionAction,
  emitNoise,
  coreBonus,
} from "./expedition.js";
import { selectInteraction } from "./interactions.js";
export const TILE = 48,
  COLS = 38,
  ROWS = 25;
export const COLORS = ["#55e9bc", "#79bdff", "#ffbc6b", "#dba3ff"];
export const ROOMS = [
  { x: 1, y: 9, w: 7, h: 7, name: "01 / SHUTTLE", tone: "#143038" },
  { x: 10, y: 9, w: 7, h: 7, name: "02 / SECURITY", tone: "#202d33" },
  { x: 10, y: 1, w: 7, h: 6, name: "03 / ENGINEERING", tone: "#29312d" },
  { x: 20, y: 1, w: 8, h: 6, name: "04 / SALVAGE", tone: "#242a37" },
  { x: 20, y: 9, w: 8, h: 7, name: "05 / POWER JUNCTION", tone: "#30302b" },
  { x: 31, y: 9, w: 6, h: 7, name: "06 / CORE VAULT", tone: "#332938" },
  { x: 10, y: 19, w: 7, h: 5, name: "07 / STORAGE", tone: "#29302d" },
  { x: 20, y: 19, w: 17, h: 5, name: "08 / SERVICE LOOP", tone: "#242c32" },
];
export function mapTiles() {
  const a = Array.from({ length: ROWS }, () => Array(COLS).fill(0));
  const carve = (x, y, w, h) => {
    for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) a[j][i] = 1;
  };
  ROOMS.forEach((r) => carve(r.x, r.y, r.w, r.h));
  [
    [8, 11, 2, 2],
    [5, 4, 5, 2],
    [5, 6, 2, 3],
    [13, 7, 2, 2],
    [17, 3, 3, 2],
    [17, 11, 3, 2],
    [28, 11, 3, 2],
    [13, 16, 2, 3],
    [17, 21, 3, 2],
    [24, 16, 2, 3],
    [33, 16, 2, 3],
  ].forEach((r) => carve(...r));
  return a;
}
export const MAP = mapTiles();
const at = (x, y) => ({ x: (x + 0.5) * TILE, y: (y + 0.5) * TILE });
const types = [
  ["Flux cell", 1, 2, 90, 3, "#65dab0"],
  ["Navigation core", 2, 2, 210, 6, "#72bfff"],
  ["Antenna spine", 1, 4, 260, 5, "#d8acfa"],
  ["Cryo capsule", 2, 3, 390, 10, "#edb469"],
  ["Memory wafer", 1, 1, 65, 1, "#75cad8"],
  ["Ancient idol", 2, 3, 680, 12, "#fa799a"],
];
export function createGame() {
  const loot = [];
  let n = 0;
  for (const [ri, count] of [
    [2, 7],
    [3, 7],
    [4, 6],
    [5, 6],
    [6, 6],
    [7, 5],
  ]) {
    const r = ROOMS[ri];
    for (let j = 0; j < count; j++) {
      const t = types[ri === 5 ? 5 : (j + ri) % 5];
      loot.push({
        id: `loot-${n++}`,
        name: t[0],
        w: t[1],
        h: t[2],
        value: t[3],
        color: t[5],
        ...at(
          r.x + 1 + ((j * 2) % (r.w - 2)),
          r.y + 1 + (Math.floor(j / 3) % (r.h - 2)),
        ),
      });
    }
  }
  return {
    ...createExpedition(),
    phase: "lobby",
    time: 0,
    disturbance: 0,
    players: [],
    loot,
    doors: [
      {
        id: "maintenance",
        ...at(8, 4),
        kind: "maintenance",
        open: false,
        locked: 0,
      },
      { id: "bridge", ...at(29, 21), kind: "bridge", open: false, locked: 0 },
      {
        id: "duo",
        ...at(18, 3),
        kind: "duo",
        open: false,
        progress: 0,
        locked: 0,
      },
      {
        id: "override",
        ...at(29, 11),
        kind: "override",
        open: false,
        progress: 0,
        locked: 0,
      },
      {
        id: "override-south",
        ...at(33, 17),
        axis: "h",
        kind: "override",
        open: false,
        progress: 0,
        locked: 0,
      },
      {
        id: "bulkhead",
        ...at(18, 11),
        kind: "normal",
        open: true,
        progress: 0,
        locked: 0,
      },
    ],
    switch: { ...at(23, 5) },
    lift: { ...at(34, 13), charges: 0 },
    shuttle: { ...at(3, 12) },
    monster: {
      ...at(35, 10),
      active: false,
      path: [],
      repath: 0,
      memory: 0,
      lastSeen: null,
      windup: 0,
      cooldown: 3,
      charge: 0,
      aim: null,
    },
    launch: null,
    escapeLeft: 180,
    logs: ["Docking complete. No life signs detected."],
    result: null,
  };
}
export function addPlayer(s, id, name) {
  if (
    s.players.length >= 4 ||
    s.phase !== "lobby" ||
    s.players.some((p) => p.id === id)
  )
    return null;
  const i = s.players.length;
  const p = {
    id,
    name: String(name || `Salvager ${i + 1}`).slice(0, 18),
    color:
      COLORS.find((c) => !s.players.some((p) => p.color === c)) || COLORS[i],
    ...at(3 + i, 13),
    inventory: [],
    alive: true,
    aboard: false,
    connected: true,
    hp: 100,
    detection: 0,
    noiseCooldown: 0,
    coreConfirmUntil: 0,
    hit: 0,
    input: { dx: 0, dy: 0, interact: false },
    inputAt: 0,
    note: "",
    noteUntil: 0,
  };
  s.players.push(p);
  return p;
}
export const score = (s, p) =>
  value(p) + (p.alive && p.aboard ? coreBonus(s) : 0);
export const value = (p) => p.inventory.reduce((v, i) => v + i.value, 0);
export function fits(items, item, x, y, w = item.w, h = item.h) {
  return (
    Number.isInteger(x) &&
    Number.isInteger(y) &&
    x >= 0 &&
    y >= 0 &&
    x + w <= 8 &&
    y + h <= 5 &&
    !items.some(
      (i) =>
        i.id !== item.id &&
        x < i.gx + i.w &&
        x + w > i.gx &&
        y < i.gy + i.h &&
        y + h > i.gy,
    )
  );
}
export function firstFit(items, item) {
  for (let y = 0; y < 5; y++)
    for (let x = 0; x < 8; x++)
      if (fits(items, item, x, y)) return { gx: x, gy: y };
  return null;
}
export const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
export function log(s, t) {
  s.logs = [t, ...s.logs].slice(0, 6);
}
export function note(s, p, t) {
  p.note = t;
  p.noteUntil = s.time + 3;
}
export function walkable(s, x, y, r = 12) {
  for (const [dx, dy] of [
    [-r, -r],
    [r, -r],
    [-r, r],
    [r, r],
  ]) {
    if (!MAP[Math.floor((y + dy) / TILE)]?.[Math.floor((x + dx) / TILE)])
      return false;
  }
  return !s.doors.some(
    (d) =>
      !d.open &&
      Math.abs(x - d.x) < TILE * (d.axis === "h" ? 1 : 0.5) + r &&
      Math.abs(y - d.y) < TILE * (d.axis === "h" ? 0.5 : 1) + r,
  );
}
export function start(s) {
  if (s.phase !== "lobby" || !s.players.length) return;
  s.phase = "salvage";
  log(
    s,
    "Find two power cells. Restore both vault circuits. Prepare your escape.",
  );
}
export function awaken(s) {
  if (s.phase !== "salvage") return;
  s.phase = "escape";
  s.disturbance = 100;
  s.monster.active = true;
  s.monster.lastSeen = { x: s.core.x, y: s.core.y };
  s.monster.memory = 20;
  for (const d of s.doors)
    if (["override", "duo"].includes(d.kind)) {
      d.open = true;
      d.locked = 0;
    }
  log(s, "IT IS AWAKE. Return to the shuttle. Trust is optional.");
}
export function action(s, id, a) {
  const p = s.players.find((p) => p.id === id);
  if (!p || !a || typeof a.type !== "string") return;
  if (a.type === "input") {
    p.input = {
      dx: Number.isFinite(a.dx) ? Math.max(-1, Math.min(1, a.dx)) : 0,
      dy: Number.isFinite(a.dy) ? Math.max(-1, Math.min(1, a.dy)) : 0,
      interact: !!a.interact,
      target: typeof a.target === "string" ? a.target : null,
    };
    p.inputAt = s.time;
    return;
  }
  if (!["salvage", "escape"].includes(s.phase) || !p.alive || !p.connected)
    return;
  if (a.type === "interact") {
    const target = selectInteraction(s, p, a.target);
    if (!target || !target.near || target.reason) return;
    if (target.command !== "hold")
      action(s, id, { type: target.command, target: target.id });
    return;
  }
  if (expeditionAction(s, p, a)) return;
  if (a.type === "moveItem") {
    const i = p.inventory.find((i) => i.id === a.id);
    if (!i) return;
    const w = a.rotate ? i.h : i.w,
      h = a.rotate ? i.w : i.h;
    if (fits(p.inventory, i, a.x, a.y, w, h))
      Object.assign(i, { gx: a.x, gy: a.y, w, h });
    else note(s, p, "That space is occupied.");
    return;
  }
  if (a.type === "drop" && !p.aboard) {
    const i = p.inventory.find((i) => i.id === a.id);
    if (i) {
      p.inventory = p.inventory.filter((j) => j.id !== i.id);
      s.loot.push({ ...i, x: p.x, y: p.y });
    }
    return;
  }
  if (
    a.type === "launch" &&
    p.aboard &&
    s.phase === "escape" &&
    s.launch === null
  ) {
    s.launch = 20;
    log(s, `${p.name} initiated departure. 20 seconds.`);
    return;
  }
  if (p.aboard) return;
  if (a.type === "pickup") {
    const i = s.loot
      .filter((i) => distance(p, i) < 70 && (!a.target || a.target === i.id))
      .sort((a, b) => distance(p, a) - distance(p, b))[0];
    if (!i) {
      note(s, p, "No salvage in reach.");
      return;
    }
    const pos = firstFit(p.inventory, i);
    if (!pos) {
      note(s, p, "Cargo full. Open TAB to rearrange or drop items.");
      return;
    }
    p.inventory.push({ ...i, ...pos });
    s.loot = s.loot.filter((j) => j.id !== i.id);

    note(s, p, `Recovered ${i.name}`);
  }
  if (a.type === "use") {
    if ((!a.target || a.target === "shuttle") && distance(p, s.shuttle) < 100) {
      if (s.phase !== "escape") {
        note(s, p, "Shuttle departs after the awakening. Keep salvaging.");
        return;
      }
      p.aboard = true;
      log(s, `${p.name} boarded with ${value(p)} credits.`);
      return;
    }
    if ((!a.target || a.target === "lift") && distance(p, s.lift) < 80) {
      if (s.phase !== "escape") {
        note(s, p, "Emergency lift activates during evacuation.");
        return;
      }
      if (!s.lift.charges) {
        note(s, p, "Lift depleted. Take the service loop.");
        return;
      }
      s.lift.charges = 0;
      Object.assign(p, at(6, 12));
      log(s, `${p.name} consumed the last lift charge.`);
    }
  }
  if (a.type === "sabotage" && s.phase === "escape") {
    const d = s.doors.find(
      (d) =>
        distance(p, d) < 100 &&
        d.locked <= 0 &&
        (!a.target || a.target === d.id),
    );
    if (d) {
      d.locked = 7;
      d.open = false;
      emitNoise(s, d, 18, "Bulkhead slam");
      log(s, `${p.name} sealed a bulkhead for 7 seconds.`);
    } else note(s, p, "Get closer to an unlocked bulkhead.");
  }
}
export function pathfind(s, from, to) {
  const key = (x, y) => y * COLS + x;
  const sx = Math.floor(from.x / TILE),
    sy = Math.floor(from.y / TILE),
    tx = Math.floor(to.x / TILE),
    ty = Math.floor(to.y / TILE);
  const q = [[sx, sy]],
    seen = new Set([key(sx, sy)]),
    prev = new Map();
  for (let n = 0; n < q.length; n++) {
    const [x, y] = q[n];
    if (x === tx && y === ty) {
      const path = [];
      let k = key(x, y);
      while (prev.has(k)) {
        path.unshift(at(k % COLS, Math.floor(k / COLS)));
        k = prev.get(k);
      }
      return path;
    }
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const nx = x + dx,
        ny = y + dy,
        k = key(nx, ny);
      if (
        !seen.has(k) &&
        walkable(s, (nx + 0.5) * TILE, (ny + 0.5) * TILE, 8)
      ) {
        seen.add(k);
        prev.set(k, key(x, y));
        q.push([nx, ny]);
      }
    }
  }
  return [];
}
export function finish(s) {
  s.phase = "ended";
  const survivors = s.players.filter((p) => p.alive && p.aboard);
  const best = Math.max(0, ...survivors.map((p) => score(s, p)));
  s.result = {
    winners: survivors.filter((p) => score(s, p) === best).map((p) => p.id),
  };
  log(
    s,
    survivors.length
      ? "Shuttle detached. The station falls silent."
      : "No crew extracted. The station keeps everything.",
  );
}
export function tick(s, dt) {
  if (!["salvage", "escape"].includes(s.phase)) return;
  dt = Math.min(0.1, Math.max(0, dt));
  s.time += dt;
  const active = s.players.filter((p) => p.alive && !p.aboard && p.connected);
  for (const d of s.doors) {
    d.locked = Math.max(0, d.locked - dt);
    if (d.locked > 0) {
      d.open = false;
      continue;
    }
    if (d.kind === "maintenance") d.open = s.prepared.maintenance;
    else if (d.kind === "bridge") d.open = s.prepared.circuit === "bridge";
    else if (d.kind === "override")
      d.open = s.sockets.every((x) => x.installed) || s.phase === "escape";
    else if (d.kind === "duo") {
      const holders = active.filter(
        (p) =>
          distance(p, d) < 120 &&
          p.input.interact &&
          p.input.target === d.id &&
          s.time - p.inputAt < 0.5,
      );
      d.progress = Math.max(
        0,
        Math.min(
          2,
          d.progress +
            (holders.length >= (s.players.length === 1 ? 1 : 2)
              ? dt
              : -dt * 0.5),
        ),
      );
      if (d.progress >= 2 || s.phase === "escape") d.open = true;
    } else d.open = true;
  }
  for (const p of active) {
    p.hit = Math.max(0, p.hit - dt);
    const input = s.time - p.inputAt < 0.5 ? p.input : { dx: 0, dy: 0 };
    const norm = Math.max(1, Math.hypot(input.dx, input.dy)),
      speed = 180,
      dx = (input.dx / norm) * speed * dt,
      dy = (input.dy / norm) * speed * dt;
    if (walkable(s, p.x + dx, p.y)) p.x += dx;
    if (walkable(s, p.x, p.y + dy)) p.y += dy;
  }
  updateExpedition(s, dt, active);
  if (s.phase === "salvage" && s.disturbance >= 100) awaken(s);
  if (s.phase === "escape") {
    s.escapeLeft -= dt;
    if (s.launch !== null) s.launch = Math.max(0, s.launch - dt);
    if (s.launch === 0 || s.escapeLeft <= 0) finish(s);
  }
  if (!s.players.some((p) => p.alive && p.connected)) finish(s);
}
