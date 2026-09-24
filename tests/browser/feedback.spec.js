import { test, expect } from "@playwright/test";
async function scenario(page, fn) {
  await page.goto("./");
  return page.evaluate(async (source) => {
    const g = await import(new URL("assets/simulation.js", location.href));
    return new Function("g", `return (${source})(g)`)(g);
  }, fn.toString());
}
test("drone detection escalates into pursuit and a telegraphed damaging shot", async ({
  page,
}) => {
  const r = await scenario(page, (g) => {
    const s = g.createGame(),
      p = g.addPlayer(s, "p", "Crew");
    g.start(s);
    const d = s.drone;
    d.repath = 999;
    d.angle = 0;
    p.x = d.x + 100;
    p.y = d.y;
    let warned = false;
    for (let i = 0; i < 45; i++) {
      g.tick(s, 0.1);
      warned ||= d.windup > 0;
    }
    return {
      warned,
      mode: d.mode,
      hp: p.hp,
      source: p.lastDamage?.source,
      alarm: s.disturbance > 0,
    };
  });
  expect(r).toEqual({
    warned: true,
    mode: "pursuit",
    hp: 85,
    source: "Drone shock shot",
    alarm: true,
  });
});
test("sidestepping a locked shot and getting behind a sealed wall prevent damage", async ({
  page,
}) => {
  const r = await scenario(page, (g) => {
    const s = g.createGame(),
      p = g.addPlayer(s, "p", "Crew");
    g.start(s);
    const d = s.drone;
    d.repath = 999;
    d.angle = 0;
    p.x = d.x + 100;
    p.y = d.y;
    for (let i = 0; i < 40 && d.windup === 0; i++) g.tick(s, 0.1);
    p.y += 70;
    for (let i = 0; i < 10; i++) g.tick(s, 0.1);
    const dodge = p.hp;
    d.x = 1008;
    d.y = 552;
    p.x = 816;
    p.y = 552;
    d.targetId = null;
    d.pursuit = 0;
    d.repath = 999;
    d.path = [];
    d.windup = 0.05;
    d.shot = { dx: -1, dy: 0 };
    const door = s.doors.find((x) => x.id === "bulkhead");
    door.locked = 7;
    door.open = false;
    g.tick(s, 0.1);
    return { dodge, cover: p.hp };
  });
  expect(r).toEqual({ dodge: 100, cover: 100 });
});
test("creature walks facing its movement and renders different gait and attack poses", async ({
  page,
}) => {
  const r = await scenario(page, (g) => {
    const s = g.createGame(),
      p = g.addPlayer(s, "p", "Crew");
    g.start(s);
    g.awaken(s);
    p.x = s.core.x;
    p.y = s.core.y;
    const m = s.monster,
      old = { x: m.x, y: m.y };
    g.tick(s, 0.1);
    const heading = Math.atan2(m.y - old.y, m.x - old.x);
    const moving = g.creatureVisualState(m);
    const c = document.createElement("canvas");
    c.width = c.height = 200;
    const ctx = c.getContext("2d");
    const sprite = {
      ...m,
      x: 100,
      y: 100,
      active: true,
      moving: true,
      windup: 0,
      charge: 0,
      gait: 0,
    };
    function capture() {
      ctx.clearRect(0, 0, 200, 200);
      g.drawCreature(ctx, sprite, 2);
      return c.toDataURL();
    }
    const first = capture();
    sprite.gait = 1.5;
    const gait = first !== capture();
    sprite.windup = 0.8;
    const brace = capture();
    sprite.windup = 0;
    sprite.charge = 0.4;
    const lunge = capture();
    return {
      moving,
      heading: Math.abs(m.facing - heading) < 0.001,
      gait,
      poses: brace !== lunge,
    };
  });
  expect(r).toEqual({
    moving: "crawling",
    heading: true,
    gait: true,
    poses: true,
  });
});
test("health is prominent; floor hazards have descriptive hover guidance without fake use prompts", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto("./");
  await page.locator("#practice").click();
  await page.locator("#start").click();
  await expect(page.locator("#room-panel")).toBeHidden();
  await expect(page.locator("#hp-text")).toHaveText("100 / 100 HP");
  await expect(page.locator("#hp-fill")).toBeVisible();
  await page.mouse.move(1123, 272);
  await expect(page.getByRole("tooltip")).toContainText("Crossing beam");
  await expect(page.getByRole("tooltip")).toContainText("10 HP");
  await expect(page.getByRole("tooltip")).not.toContainText("Press E to use");
  await page.mouse.move(1167, 272);
  await expect(page.getByRole("tooltip")).toContainText("Loose metal");
  await expect(page.getByRole("tooltip")).toContainText("not collectible");
  await page.screenshot({ path: "test-results/feedback-hazards.png" });
});
test("inspecting hazards never steals the default E interaction from actual controls", async ({
  page,
}) => {
  const r = await scenario(page, (g) => {
    const s = g.createGame(),
      p = g.addPlayer(s, "p", "Crew");
    g.start(s);
    p.x = s.shuttle.x;
    p.y = s.shuttle.y;
    const all = g.interactions(s, p);
    return {
      nearest: g.selectInteraction(s, p).id,
      beam: all.find((i) => i.id === "hazard-0").command,
      loot: all.find((i) => i.command === "pickup").category,
      control: all.find((i) => i.id === "security").category,
    };
  });
  expect(r).toEqual({
    nearest: "shuttle",
    beam: "inspect",
    loot: "LOOT",
    control: "CONTROL",
  });
});
