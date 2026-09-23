import { test, expect } from "@playwright/test";
// Tests instantiate the shipped simulation in Chromium on GitHub Pages.
// No local server, test-only game controls, or substituted mechanics.
async function scenario(page, fn) {
  await page.goto("./");
  return page.evaluate(async (source) => {
    const g = await import(new URL("assets/simulation.js", location.href));
    return new Function("g", `return (${source})(g)`)(g);
  }, fn.toString());
}
test("cargo has no speed penalty and idle exploration does not awaken the beast", async ({
  page,
}) => {
  const r = await scenario(page, (g) => {
    const s = g.createGame();
    g.addPlayer(s, "a", "A");
    g.addPlayer(s, "b", "B");
    g.start(s);
    const [a, b] = s.players;
    a.x = b.x = 600;
    a.y = b.y = 650;
    b.inventory = [{ id: "big", w: 2, h: 3, gx: 0, gy: 0, value: 1200 }];
    for (let i = 0; i < 10; i++) {
      for (const p of s.players) g.action(s, p.id, { type: "input", dx: 1 });
      g.tick(s, 0.1);
    }
    const equal = a.x === b.x;
    for (let i = 0; i < 6000; i++) g.tick(s, 0.1);
    return {
      equal,
      phase: s.phase,
      disturbance: s.disturbance,
      weight: "weight" in b.inventory[0],
    };
  });
  expect(r).toEqual({
    equal: true,
    phase: "salvage",
    disturbance: 0,
    weight: false,
  });
});
test("power delivery gates vault, route choice is exclusive and locks need two crew", async ({
  page,
}) => {
  const r = await scenario(page, (g) => {
    const s = g.createGame();
    g.addPlayer(s, "a", "A");
    g.addPlayer(s, "b", "B");
    g.start(s);
    const [a, b] = s.players;
    for (let i = 0; i < 2; i++) {
      Object.assign(a, { x: s.cells[i].x, y: s.cells[i].y });
      g.action(s, a.id, { type: "interact", target: s.cells[i].id });
      Object.assign(a, { x: s.sockets[i].x, y: s.sockets[i].y });
      g.action(s, a.id, { type: "interact", target: s.sockets[i].id });
    }
    g.tick(s, 0.1);
    const doors = s.doors
      .filter((d) => d.kind === "override")
      .every((d) => d.open);
    Object.assign(a, s.consoles[2], { id: "a" });
    g.action(s, "a", { type: "interact", target: "circuit-lift" });
    Object.assign(a, { x: s.consoles[3].x, y: s.consoles[3].y });
    g.action(s, "a", { type: "interact", target: "circuit-bridge" });
    for (let i = 0; i < 2; i++)
      Object.assign(s.players[i], { x: s.locks[i].x, y: s.locks[i].y });
    for (let i = 0; i < 25; i++) {
      g.action(s, "a", { type: "input", interact: true, target: "lock-a" });
      g.tick(s, 0.1);
    }
    const one = s.core.unlocked;
    for (let i = 0; i < 25; i++) {
      g.action(s, "a", { type: "input", interact: true, target: "lock-a" });
      g.action(s, "b", { type: "input", interact: true, target: "lock-b" });
      g.tick(s, 0.1);
    }
    return {
      doors,
      installed: s.sockets.every((c) => c.installed),
      one,
      two: s.core.unlocked,
      route: s.prepared.circuit,
      charges: s.lift.charges,
    };
  });
  expect(r).toEqual({
    doors: true,
    installed: true,
    one: false,
    two: true,
    route: "lift",
    charges: 1,
  });
});
test("core confirmation, cargo space, death recovery and shared extraction bonus", async ({
  page,
}) => {
  const r = await scenario(page, (g) => {
    const s = g.createGame();
    for (const id of ["a", "b", "c"]) g.addPlayer(s, id, id);
    g.start(s);
    const [a, b, c] = s.players;
    s.core.unlocked = true;
    Object.assign(a, { x: s.core.x, y: s.core.y });
    a.inventory = [{ id: "full", w: 8, h: 5, gx: 0, gy: 0, value: 1 }];
    g.action(s, "a", { type: "interact", target: "core" });
    const full = s.core.taken;
    a.inventory = [];
    g.action(s, "a", { type: "interact", target: "core" });
    const first = s.phase;
    g.action(s, "a", { type: "interact", target: "core" });
    const second = s.phase;
    g.action(s, "a", { type: "drop", id: "core-loot" });
    Object.assign(b, { x: a.x, y: a.y });
    g.action(s, "b", { type: "interact", target: "core-loot" });
    for (const p of [a, b]) {
      Object.assign(p, { x: s.shuttle.x, y: s.shuttle.y });
      g.action(s, p.id, { type: "interact", target: "shuttle" });
    }
    g.action(s, "a", { type: "interact", target: "shuttle" });
    for (let i = 0; i < 205; i++) g.tick(s, 0.1);
    return {
      full,
      first,
      second,
      phase: s.phase,
      winners: s.result.winners,
      a: g.score(s, a),
      b: g.score(s, b),
      c: g.score(s, c),
    };
  });
  expect(r).toEqual({
    full: false,
    first: "salvage",
    second: "escape",
    phase: "ended",
    winners: ["b"],
    a: 200,
    b: 1400,
    c: 0,
  });
});
test("noise causes premature awakening; ordinary pickups do not; drone investigates", async ({
  page,
}) => {
  const r = await scenario(page, (g) => {
    const s = g.createGame();
    const p = g.addPlayer(s, "a", "A");
    g.start(s);
    Object.assign(p, { x: s.loot[0].x, y: s.loot[0].y });
    g.action(s, p.id, { type: "interact", target: s.loot[0].id });
    const quiet = s.disturbance;
    g.emitNoise(s, p, 40, "Test machinery");
    const investigate = s.drone.investigate.x === p.x;
    g.emitNoise(s, p, 60, "Alarm");
    s.core.unlocked = true;
    Object.assign(p, { x: s.core.x, y: s.core.y });
    g.action(s, p.id, { type: "interact", target: "core" });
    return {
      quiet,
      investigate,
      phase: s.phase,
      taken: s.core.taken,
      escapeDoors: s.doors
        .filter((d) => ["duo", "override"].includes(d.kind))
        .every((d) => d.open),
    };
  });
  expect(r).toEqual({
    quiet: 0,
    investigate: true,
    phase: "escape",
    taken: false,
    escapeDoors: true,
  });
});
test("stabilizer reduces extraction noise and shutter grace lets operator cross", async ({
  page,
}) => {
  const r = await scenario(page, (g) => {
    function extract(help) {
      const s = g.createGame();
      const p = g.addPlayer(s, "a", "A"),
        q = g.addPlayer(s, "b", "B");
      g.start(s);
      Object.assign(p, { x: s.salvage.x, y: s.salvage.y });
      Object.assign(q, { x: s.stabilizer.x, y: s.stabilizer.y });
      if (help)
        g.action(s, q.id, {
          type: "input",
          interact: true,
          target: "stabilizer",
        });
      g.action(s, p.id, { type: "interact", target: "salvage-machine" });
      return s.disturbance;
    }
    const s = g.createGame(),
      p = g.addPlayer(s, "a", "A");
    g.start(s);
    Object.assign(p, { x: s.consoles[0].x, y: s.consoles[0].y });
    g.action(s, p.id, { type: "input", interact: true, target: "security" });
    g.tick(s, 0.1);
    g.action(s, p.id, { type: "input", interact: false });
    for (let i = 0; i < 30; i++) g.tick(s, 0.1);
    return {
      safe: extract(true),
      loud: extract(false),
      grace: s.securityHeldUntil > s.time,
    };
  });
  expect(r).toEqual({ safe: 4, loud: 35, grace: true });
});
test("inventory rejects overlap and rotates; lift race, sealing and lunge are host resolved", async ({
  page,
}) => {
  const r = await scenario(page, (g) => {
    const s = g.createGame();
    const a = g.addPlayer(s, "a", "A"),
      b = g.addPlayer(s, "b", "B");
    g.start(s);
    a.inventory = [
      { id: "long", w: 1, h: 4, gx: 0, gy: 0, value: 1 },
      { id: "block", w: 2, h: 2, gx: 2, gy: 0, value: 1 },
    ];
    g.action(s, "a", {
      type: "moveItem",
      id: "long",
      x: 1,
      y: 0,
      rotate: true,
    });
    const reject = a.inventory[0].w === 1;
    g.action(s, "a", {
      type: "moveItem",
      id: "long",
      x: 4,
      y: 0,
      rotate: true,
    });
    const rotate = a.inventory[0].w === 4;
    g.awaken(s);
    s.prepared.circuit = "lift";
    s.lift.charges = 1;
    for (const p of [a, b]) Object.assign(p, { x: s.lift.x, y: s.lift.y });
    g.action(s, "a", { type: "interact", target: "lift" });
    g.action(s, "b", { type: "interact", target: "lift" });
    const once = a.x < 8 * g.TILE && b.x > 30 * g.TILE;
    Object.assign(b, { x: s.shuttle.x, y: s.shuttle.y });
    const door = s.doors.find((d) => d.id === "bulkhead");
    Object.assign(a, { x: door.x - 50, y: door.y });
    g.action(s, "a", { type: "interact", target: door.id });
    const sealed = !g.walkable(s, door.x, door.y);
    for (let i = 0; i < 71; i++) g.tick(s, 0.1);
    Object.assign(b, { x: s.monster.x - 85, y: s.monster.y });
    s.monster.cooldown = 0;
    g.tick(s, 0.1);
    return {
      reject,
      rotate,
      once,
      sealed,
      reopened: door.open,
      warning: s.monster.windup > 0,
    };
  });
  expect(r).toEqual({
    reject: true,
    rotate: true,
    once: true,
    sealed: true,
    reopened: true,
    warning: true,
  });
});
