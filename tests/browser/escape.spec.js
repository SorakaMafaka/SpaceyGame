import { test, expect } from "@playwright/test";
// Advance the browser clock and frame timestamps to exercise a full expedition
// on the deployed game without spending nine real minutes waiting for awakening.
test("E seals a bulkhead, boards, and starts irreversible departure on Pages", async ({
  page,
}) => {
  test.setTimeout(180000);
  await page.clock.install();
  await page.addInitScript(() => {
    const raf = window.requestAnimationFrame.bind(window);
    window.requestAnimationFrame = (callback) =>
      raf((time) => callback(time * 10));
  });
  await page.goto("./");
  await page.locator("#practice").click();
  await page.locator("#start").click();
  await page.clock.runFor(86000);
  await expect(page.locator("#phase")).toContainText("AWAKE");
  async function move(key, ms) {
    await page.keyboard.down(key);
    await page.clock.runFor(ms);
    await page.keyboard.up(key);
    await page.clock.runFor(40);
  }
  await move("w", 80);
  await move("d", 580);
  await expect(page.locator("#prompt")).toContainText("Bulkhead");
  await page.keyboard.press("e");
  await page.clock.runFor(40);
  await expect(page.locator("#prompt")).toContainText("Sealed for");
  await expect(page.locator("#events")).toContainText("sealed a bulkhead");
  await move("a", 540);
  await page.keyboard.press("e");
  await page.clock.runFor(40);
  await expect(page.locator("#crew")).toContainText("ABOARD");
  await expect(page.locator("#prompt")).toContainText("Departure console");
  await page.keyboard.press("e");
  await page.clock.runFor(40);
  await expect(page.locator("#meter-label")).toContainText("LAUNCH");
  await page.clock.runFor(3500);
  await expect(page.locator("#results")).toBeVisible();
  await expect(page.locator("#results")).toContainText("Richest survivor");
});
