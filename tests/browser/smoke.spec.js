import { test, expect } from "@playwright/test";
test("solo recon, movement and cargo panel work without browser errors", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("./");
  await expect(page.getByText("Good crew.")).toBeVisible();
  await page.getByRole("button", { name: "SOLO RECON" }).click();
  await page.getByRole("button", { name: "DEPLOY CREW" }).click();
  await expect(page.locator("#room-panel")).toBeHidden();
  await page.keyboard.press("Tab");
  await expect(page.locator("#inventory")).toBeVisible();
  await expect(page.locator(".cell")).toHaveCount(40);
  await page.keyboard.press("Tab");
  await expect(page.locator("#inventory")).toBeHidden();
  await page.keyboard.down("d");
  await page.waitForTimeout(600);
  await page.keyboard.up("d");
  await expect(page.locator("#credits")).toHaveText("0 CR");
  expect(errors).toEqual([]);
  await page.screenshot({ path: "test-results/solo-recon.png" });
});
test("invalid room code gives an actionable error", async ({ page }) => {
  await page.goto("./");
  await page.locator("#code").fill("bad");
  await page.getByRole("button", { name: "JOIN CREW" }).click();
  await expect(page.locator("#status")).toContainText("eight-character");
});

test("recover, drag, rotate and drop salvage through the real UI", async ({
  page,
}) => {
  await page.goto("./");
  await page.locator("#practice").click();
  await page.locator("#start").click();
  async function move(key, ms) {
    await page.keyboard.down(key);
    await page.waitForTimeout(ms);
    await page.keyboard.up(key);
    await page.waitForTimeout(80);
  }
  await move("w", 535);
  await move("d", 2670);
  await move("s", 2400);
  await page.keyboard.press("e");
  await page.keyboard.press("Tab");
  const item = page.locator(".cargo-item");
  await expect(item).toHaveCount(1);
  await expect(item).toContainText("Antenna spine");
  await item.dragTo(
    page.getByRole("button", { name: "Cargo cell 4, 1", exact: true }),
  );
  await expect(item).toHaveCSS("grid-column-start", "4");
  await page.keyboard.press("r");
  await item.click();
  await expect(item).toHaveCSS("grid-column-end", "span 4");
  await page.locator("#drop").click();
  await expect(item).toHaveCount(0);
  await expect(page.locator("#credits")).toHaveText("0 CR");
});

test("nearby objects explain their action on hover and use only E", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto("./");
  await page.locator("#practice").click();
  await page.locator("#start").click();
  await expect(page.locator("#room-panel")).toBeHidden();
  await page.mouse.move(640, 316);
  await expect(page.getByRole("tooltip")).toBeVisible();
  await expect(page.getByRole("tooltip")).toContainText("Board shuttle");
  await expect(page.getByRole("tooltip")).toContainText("Boarding is final");
  await expect(page.getByRole("tooltip")).toContainText("Available after");
  await expect(page.locator("#controls")).not.toContainText("Launch");
  await expect(page.locator("#controls")).not.toContainText("Pick up");
  await page.mouse.move(20, 400);
  await expect(page.getByRole("tooltip")).toBeHidden();
});
