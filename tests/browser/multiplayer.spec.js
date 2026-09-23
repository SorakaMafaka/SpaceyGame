import { test, expect } from "@playwright/test";
test("four peers join, deploy, receive movement and handle host departure", async ({
  browser,
}) => {
  test.setTimeout(90000);
  const contexts = await Promise.all(
    Array.from({ length: 4 }, () => browser.newContext()),
  );
  try {
    const pages = await Promise.all(contexts.map((c) => c.newPage()));
    const errors = [];
    for (const p of pages) p.on("pageerror", (e) => errors.push(e.message));
    await Promise.all(pages.map((p) => p.goto("./")));
    await pages[0].locator("#name").fill("Captain");
    await pages[0].locator("#host").click();
    await expect(pages[0].locator("#game")).toBeVisible({ timeout: 25000 });
    const code = await pages[0].locator("#room-code").textContent();
    for (let i = 1; i < 4; i++) {
      await pages[i].locator("#name").fill("Crew " + i);
      await pages[i].locator("#code").fill(code);
      await pages[i].locator("#join").click();
      await expect(pages[i].locator("#game")).toBeVisible({ timeout: 25000 });
    }
    await expect(pages[0].locator("#roster")).toContainText("Crew 3");
    await pages[0].locator("#start").click();
    for (const p of pages) {
      await expect(p.locator("#room-panel")).toBeHidden();
      await expect(p.locator(".crew-member")).toHaveCount(4);
    }
    await pages[1].keyboard.down("d");
    await pages[1].waitForTimeout(1000);
    await pages[1].keyboard.up("d");
    await expect(pages[1].locator("#notice")).toBeEmpty();
    expect(errors).toEqual([]);
    await pages[0].close();
    await expect(pages[1].locator("#notice")).toContainText(
      "Host disconnected",
      { timeout: 15000 },
    );
  } finally {
    await Promise.all(contexts.map((c) => c.close()));
  }
});
