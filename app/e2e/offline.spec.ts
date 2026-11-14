// Без сети: установленное приложение открывается и играет демо-эфир из кэша service worker.
// Service worker есть только в боевой сборке, поэтому тест идёт на ней (второй сервер в playwright.config.ts).
import { expect, test } from "@playwright/test";
import { BUILT } from "../playwright.config";

const URL = `http://localhost:${BUILT}`;

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("sushhh.v2.consent", JSON.stringify({ v: 2, at: 0 }));
    localStorage.setItem("sushhh.v2.tips", "1");
  });
  await page.route(/supabase\.co/, (r) => r.abort("internetdisconnected"));
});

test("без сети приложение открывается, эфир играет, корень и ссылки из уведомлений ведут в овал", async ({ page, context }) => {
  await page.goto(`${URL}/v2/`);
  // первый запуск: service worker ставится и складывает приложение в кэш
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => undefined));
  await page.reload();
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);

  await context.setOffline(true);
  await page.reload();
  await expect(page.locator("#hint")).toHaveText("коснись — и эфир заиграет");
  await page.locator("#cap").click();
  await expect(page.locator("#track")).toHaveAttribute("data-bars", /^\d+$/); // демо-голос загрузился из кэша
  // плеер просит файл кусками — из кэша приходит кусок (206), как ждёт Safari на iPhone
  const part = await page.evaluate(async () => {
    const r = await fetch("/seed/s3.m4a", { headers: { Range: "bytes=0-99" } });
    return { status: r.status, range: r.headers.get("Content-Range"), size: (await r.arrayBuffer()).byteLength };
  });
  expect(part.status).toBe(206);
  expect(part.range).toMatch(/^bytes 0-99\/\d+$/);
  expect(part.size).toBe(100);

  // иконка на экране «Домой» открывает корень, уведомление — ?thread=
  await page.goto(`${URL}/?from=home`);
  await expect(page).toHaveURL(/\/v2\/\?from=home$/);
  await expect(page.locator("#cap")).toBeVisible();
  await page.goto(`${URL}/v2/?thread=nope`);
  await expect(page.locator("#cap")).toBeVisible();
});
