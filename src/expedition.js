import {
  TILE,
  MAP,
  distance,
  firstFit,
  walkable,
  pathfind,
  awaken,
  log,
  note,
} from "./game.js";
const at = (x, y) => ({ x: (x + 0.5) * TILE, y: (y + 0.5) * TILE });
export function createExpedition() {
  return {
    core: {
      id: "core",
      ...at(34, 11),
      taken: false,
      unlocked: false,
      progress: 0,
    },
    locks: [
      { id: "lock-a", ...at(32, 10) },
      { id: "lock-b", ...at(35, 14) },
    ],
    sockets: [
      { id: "socket-a", ...at(21, 10), installed: false },
      { id: "socket-b", ...at(26, 14), installed: false },
    ],
    cells: [
      { id: "cell-a", ...at(12, 3), taken: false },
      { id: "cell-b", ...at(14, 21), taken: false },
    ],
    prepared: { maintenance: false, circuit: null },
    consoles: [
      { id: "security", ...at(11, 12) },
      { id: "maintenance-console", ...at(22, 3) },
      { id: "circuit-lift", ...at(23, 12) },
      { id: "circuit-bridge", ...at(25, 12) },
    ],
    stabilizer: { id: "stabilizer", ...at(23, 5) },
    salvage: { id: "salvage-machine", ...at(26, 4), taken: false },
    containers: [
      { id: "cache-a", ...at(11, 20), opened: false },
      { id: "cache-b", ...at(22, 21), opened: false },
    ],
    noises: [],
    noiseSeq: 0,
    securityHeldUntil: 0,
    debris: [
      { ...at(15, 11), cooldown: 0 },
      { ...at(22, 12), cooldown: 0 },
      { ...at(32, 21), cooldown: 0 },
    ],
    hazards: [
      { ...at(14, 11), kind: "scanner", length: 150 },
      { ...at(24, 21), kind: "vent", length: 50 },
    ],
    drone: {
      ...at(24, 12),
      angle: 0,
      path: [],
      repath: 0,
      investigate: null,
      interest: 0,
      alarmCooldown: 0,
      patrol: 0,
      targetId: null,
      pursuit: 0,
      windup: 0,
      shotCooldown: 0,
      shot: null,
      flash: 0,
      mode: "patrol",
    },
  };
}
export function coreBonus(s) {
  return s.players.some(
    (p) => p.alive && p.aboard && p.inventory.some((i) => i.id === "core-loot"),
  )
    ? 200
    : 0;
}
const held = (s, p, id, o, r = 75) =>
  p.input.interact &&
  p.input.target === id &&
  s.time - p.inputAt < 0.5 &&
  distance(p, o) < r;
export function emitNoise(s, o, power, label) {
  s.noiseSeq++;
  s.noises.push({ id: s.noiseSeq, x: o.x, y: o.y, power, label, age: 0 });
  s.noises = s.noises.slice(-15);
  if (s.phase === "salvage")
    s.disturbance = Math.min(100, s.disturbance + power);
  if (s.phase === "salvage" && s.disturbance >= 100) awaken(s);
  s.drone.investigate = { x: o.x, y: o.y };
  s.drone.interest = 7;
  if (s.monster.active && o.x > 8 * TILE) {
    s.monster.lastSeen = { x: o.x, y: o.y };
    s.monster.memory = 10;
    s.monster.repath = 0;
  }
}
export function lineOfSight(s, a, b) {
  const d = distance(a, b);
  for (let t = 0; t <= d; t += 12) {
    const f = d ? t / d : 0;
    if (!walkable(s, a.x + (b.x - a.x) * f, a.y + (b.y - a.y) * f, 1))
      return false;
  }
  return true;
}
export function hazardState(s, h) {
  const period = s.phase === "escape" ? 3 : 5;
  const t = s.time % period;
  if (h.kind === "scanner" && s.securityHeldUntil > s.time) return "safe";
  if (h.kind === "vent" && s.phase !== "escape") return "safe";
  return t < period - 1.6 ? "safe" : t < period - 0.8 ? "warning" : "active";
}
function hurt(s, p, amount, source = "Creature attack") {
  if (p.hit > 0 || !p.alive) return;
  p.hp = Math.max(0, p.hp - amount);
  p.hit = 1.2;
  p.lastDamage = { amount, source, time: s.time };
  note(s, p, `−${amount} HP · ${source}`);
  if (!p.hp) {
    p.alive = false;
    s.loot.push(...p.inventory.map((i) => ({ ...i, x: p.x, y: p.y })));
    p.inventory = [];
    log(s, `${p.name}'s signal was lost.`);
  }
}
export function expeditionAction(s, p, a) {
  if (a.type !== "expedition") return false;
  if (p.aboard) return true;
  const id = a.target;
  const cell = s.cells.find((c) => c.id === id);
  if (cell && !cell.taken && distance(p, cell) < 70) {
    const item = {
      id: cell.id,
      name: "Power cell",
      w: 1,
      h: 2,
      value: 0,
      color: "#a5faff",
      kind: "power",
    };
    const pos = firstFit(p.inventory, item);
    if (!pos) {
      note(s, p, "Make room for a 1×2 power cell.");
      return true;
    }
    p.inventory.push({ ...item, ...pos });
    cell.taken = true;
    note(s, p, "Power cell recovered. Install it at the junction.");
    return true;
  }
  const socket = s.sockets.find((c) => c.id === id);
  if (socket && distance(p, socket) < 75 && !socket.installed) {
    const i = p.inventory.find((i) => i.kind === "power");
    if (!i) {
      note(s, p, "Bring a power cell from Engineering or Storage.");
      return true;
    }
    p.inventory = p.inventory.filter((j) => j.id !== i.id);
    socket.installed = true;
    emitNoise(s, socket, 8, "Circuit restored");
    log(s, `${p.name} restored a vault circuit.`);
    return true;
  }
  const console = s.consoles.find((c) => c.id === id);
  if (console && distance(p, console) < 75) {
    if (id === "maintenance-console" && !s.prepared.maintenance) {
      s.prepared.maintenance = true;
      emitNoise(s, console, 5, "Maintenance route unlocked");
      log(s, "Maintenance shortcut to the shuttle unlocked.");
    }
    if (
      id.startsWith("circuit-") &&
      !s.prepared.circuit &&
      s.sockets.every((x) => x.installed)
    ) {
      s.prepared.circuit = id === "circuit-lift" ? "lift" : "bridge";
      s.lift.charges = s.prepared.circuit === "lift" ? 1 : 0;
      emitNoise(s, console, 5, "Emergency route powered");
      log(
        s,
        `Emergency ${s.prepared.circuit} powered. The other circuit is offline.`,
      );
    }
    return true;
  }
  if (
    id === "salvage-machine" &&
    !s.salvage.taken &&
    distance(p, s.salvage) < 70
  ) {
    const stabilized = s.players.some(
      (q) =>
        q.alive &&
        q.connected &&
        !q.aboard &&
        held(s, q, "stabilizer", s.stabilizer),
    );
    const item = {
      id: "machine-loot",
      name: "Quantum assembly",
      w: 2,
      h: 3,
      value: 900,
      color: "#ffcf83",
    };
    const pos = firstFit(p.inventory, item);
    if (!pos) {
      note(s, p, "Make room for a 2×3 assembly.");
      return true;
    }
    s.salvage.taken = true;
    p.inventory.push({ ...item, ...pos });
    emitNoise(
      s,
      s.salvage,
      stabilized ? 4 : 35,
      stabilized ? "Stabilized extraction" : "Unstable extraction alarm",
    );
    note(
      s,
      p,
      stabilized
        ? "Assembly extracted safely."
        : "Unstabilized extraction triggered an alarm!",
    );
    return true;
  }
  const cache = s.containers.find((c) => c.id === id);
  if (cache && !cache.opened && distance(p, cache) < 70) {
    cache.opened = true;
    s.loot.push({
      id: cache.id + "-loot",
      name: "Sealed data prism",
      w: 2,
      h: 2,
      value: 350,
      color: "#d9a6ff",
      x: cache.x + 22,
      y: cache.y,
    });
    emitNoise(s, cache, 15, "Container forced");
    return true;
  }
  if (id === "core" && !s.core.taken && distance(p, s.core) < 75) {
    if (s.phase !== "salvage") {
      note(s, p, "Emergency lockdown: the core is sealed. Escape!");
      return true;
    }
    if (!s.core.unlocked) {
      note(s, p, "Release both vault locks first.");
      return true;
    }
    const item = {
      id: "core-loot",
      name: "Ancient core",
      w: 2,
      h: 3,
      value: 1200,
      color: "#ff85b1",
    };
    const pos = firstFit(p.inventory, item);
    if (!pos) {
      note(s, p, "Make room for the 2×3 core before extraction.");
      return true;
    }
    if (p.coreConfirmUntil <= s.time) {
      p.coreConfirmUntil = s.time + 5;
      note(
        s,
        p,
        "WARNING: this wakes the creature. Press E again within 5 seconds.",
      );
      return true;
    }
    s.core.taken = true;
    p.inventory.push({ ...item, ...pos });
    log(
      s,
      `${p.name} took the core. Extract it for a 200-credit bonus per survivor.`,
    );
    awaken(s);
    return true;
  }
  return true;
}
function follow(s, o, speed, dt) {
  if (!o.path.length) return;
  const t = o.path[0],
    d = distance(o, t),
    step = Math.min(d, speed * dt);
  if (d < 2) {
    o.path.shift();
    return;
  }
  const x = o.x + ((t.x - o.x) / d) * step,
    y = o.y + ((t.y - o.y) / d) * step;
  if (walkable(s, x, y, 8)) {
    o.x = x;
    o.y = y;
  } else o.repath = 0;
}
export function updateExpedition(s, dt, active) {
  for (const n of s.noises) n.age += dt;
  s.noises = s.noises.filter((n) => n.age < 1.5);
  if (s.phase === "salvage")
    s.disturbance = Math.max(0, s.disturbance - dt * 0.25);
  if (active.some((p) => held(s, p, "security", s.consoles[0])))
    s.securityHeldUntil = s.time + 6;
  if (!s.core.unlocked && s.sockets.every((c) => c.installed)) {
    const heldLocks = s.locks.filter((l) =>
      active.some((p) => held(s, p, l.id, l)),
    );
    if (s.players.length === 1) {
      for (const l of heldLocks) l.latched = true;
    }
    const ready =
      s.players.length === 1
        ? s.locks.every((l) => l.latched)
        : heldLocks.length === 2;
    s.core.progress = Math.max(
      0,
      Math.min(2, s.core.progress + (ready ? dt : -dt)),
    );
    if (s.core.progress >= 2) {
      s.core.unlocked = true;
      log(s, "Core restraints released. Extraction will wake the creature.");
    }
  }
  for (const d of s.debris) {
    d.cooldown = Math.max(0, d.cooldown - dt);
    if (
      !d.cooldown &&
      active.some(
        (p) => distance(p, d) < 28 && Math.hypot(p.input.dx, p.input.dy) > 0,
      )
    ) {
      d.cooldown = 2;
      emitNoise(s, d, 10, "Loose metal underfoot");
    }
  }
  for (const h of s.hazards) {
    if (hazardState(s, h) !== "active") continue;
    for (const p of active) {
      const contact =
        h.kind === "scanner"
          ? Math.abs(p.x - h.x) < 12 && Math.abs(p.y - h.y) < h.length
          : distance(p, h) < h.length;
      if (contact && p.hit === 0) {
        hurt(
          s,
          p,
          h.kind === "vent" ? 20 : 10,
          h.kind === "vent" ? "Steam vent" : "Crossing beam",
        );
        emitNoise(
          s,
          p,
          h.kind === "scanner" ? 22 : 5,
          h.kind === "scanner" ? "Security beam alarm" : "Steam discharge",
        );
      }
    }
  }
  const d = s.drone;
  d.interest = Math.max(0, d.interest - dt);
  d.alarmCooldown = Math.max(0, d.alarmCooldown - dt);
  d.pursuit = Math.max(0, d.pursuit - dt);
  d.shotCooldown = Math.max(0, d.shotCooldown - dt);
  d.flash = Math.max(0, d.flash - dt);
  const tracked = active.find(
    (p) => p.id === d.targetId && p.alive && p.x > 8 * TILE,
  );
  const tracking = tracked && d.pursuit > 0;
  if (tracking && lineOfSight(s, d, tracked)) {
    d.investigate = { x: tracked.x, y: tracked.y };
    d.interest = 5;
    d.pursuit = 5;
  }
  d.mode = tracking ? "pursuit" : d.interest > 0 ? "investigating" : "patrol";
  d.repath -= dt;
  if (d.repath <= 0) {
    d.repath = 0.7;
    const route = [at(21, 11), at(26, 11), at(26, 14), at(21, 14)];
    const target = d.interest > 0 ? d.investigate : route[d.patrol];
    if (distance(d, target) < 25) d.patrol = (d.patrol + 1) % route.length;
    d.path = pathfind(s, d, target);
  }
  if (d.path.length) d.angle = Math.atan2(d.path[0].y - d.y, d.path[0].x - d.x);
  if (d.windup <= 0) follow(s, d, tracking ? 105 : 65, dt);
  if (tracking && lineOfSight(s, d, tracked))
    d.angle = Math.atan2(tracked.y - d.y, tracked.x - d.x);
  for (const p of active) {
    const a = Math.atan2(p.y - d.y, p.x - d.x),
      delta = Math.atan2(Math.sin(a - d.angle), Math.cos(a - d.angle));
    const seen =
      distance(p, d) < 220 && Math.abs(delta) < 0.65 && lineOfSight(s, d, p);
    p.detection = Math.max(
      0,
      Math.min(100, p.detection + dt * (seen ? 38 : -28)),
    );
    if (p.detection >= 100 && !d.alarmCooldown) {
      d.alarmCooldown = 7;
      p.detection = 100;
      d.targetId = p.id;
      d.pursuit = 5;
      d.repath = 0;
      d.mode = "pursuit";
      emitNoise(s, p, 30, "Drone detection alarm");
      log(
        s,
        `${p.name} detected! Drone pursuing. Break sight or dodge the shock shot.`,
      );
      note(s, p, "DETECTED · Drone pursuing. Break line of sight!");
    }
  }
  if (d.windup > 0) {
    d.windup = Math.max(0, d.windup - dt);
    if (d.windup === 0 && d.shot) {
      d.flash = 0.22;
      d.shotCooldown = 2.4;
      for (const p of active) {
        const vx = p.x - d.x,
          vy = p.y - d.y,
          along = vx * d.shot.dx + vy * d.shot.dy,
          across = Math.abs(vx * d.shot.dy - vy * d.shot.dx);
        if (
          p.x > 8 * TILE &&
          along > 0 &&
          along < 260 &&
          across < 18 &&
          lineOfSight(s, d, p)
        )
          hurt(s, p, 15, "Drone shock shot");
      }
    }
  } else if (
    tracking &&
    !d.shotCooldown &&
    distance(d, tracked) < 240 &&
    lineOfSight(s, d, tracked)
  ) {
    const len = distance(d, tracked) || 1;
    d.shot = { dx: (tracked.x - d.x) / len, dy: (tracked.y - d.y) / len };
    d.windup = 0.9;
  }
  const m = s.monster;
  if (!m.active) {
    m.moving = false;
    return;
  }
  const before = { x: m.x, y: m.y };
  m.cooldown = Math.max(0, m.cooldown - dt);
  m.memory = Math.max(0, m.memory - dt);
  const target = active
    .filter(
      (p) =>
        p.alive &&
        p.x > 8 * TILE &&
        distance(m, p) < 380 &&
        lineOfSight(s, m, p),
    )
    .sort((a, b) => distance(m, a) - distance(m, b))[0];
  if (target) {
    m.lastSeen = { x: target.x, y: target.y };
    m.memory = 8;
  }
  if (m.windup > 0) {
    m.windup = Math.max(0, m.windup - dt);
    if (m.windup === 0) {
      m.charge = 0.45;
      emitNoise(s, m, 0, "Creature lunge");
    }
  } else if (m.charge > 0) {
    m.charge = Math.max(0, m.charge - dt);
    const a = m.aim;
    for (let i = 0; i < 4; i++) {
      const x = m.x + (a.x * 390 * dt) / 4,
        y = m.y + (a.y * 390 * dt) / 4;
      if (x > 8 * TILE && walkable(s, x, y, 12)) {
        m.x = x;
        m.y = y;
      } else {
        m.charge = 0;
        break;
      }
    }
  } else if (target && distance(m, target) < 210 && !m.cooldown) {
    const len = distance(m, target) || 1;
    m.aim = { x: (target.x - m.x) / len, y: (target.y - m.y) / len };
    m.windup = 0.9;
    m.cooldown = 4;
  } else {
    m.repath -= dt;
    if (m.repath <= 0) {
      m.repath = 0.5;
      m.path = m.memory > 0 && m.lastSeen ? pathfind(s, m, m.lastSeen) : [];
    }
    follow(s, m, 165, dt);
  }
  const travelled = distance(before, m);
  m.moving = travelled > 0.01;
  if (m.moving) m.facing = Math.atan2(m.y - before.y, m.x - before.x);
  m.gait = (m.gait || 0) + travelled * 0.09;
  for (const p of active)
    if (p.x > 8 * TILE && distance(p, m) < 34)
      hurt(s, p, m.charge > 0 ? 45 : 30);
}

export function creatureVisualState(m) {
  return !m.active
    ? "sleeping"
    : m.windup > 0
      ? "bracing"
      : m.charge > 0
        ? "lunging"
        : m.moving
          ? "crawling"
          : "searching";
}
