// v2 «капсула»: эфир играет, запись доходит до «Моё» и переживает перезагрузку, сбой сети не глушит эфир.
import { expect, test, type Page } from "@playwright/test";

const open = async (page: Page) => {
  await page.goto("/v2/");
  await expect(page.locator("#hint")).toHaveText("коснись — и эфир заиграет");
};
// касание капсулы — пауза или «играть»
const tapCapsule = (page: Page) => page.locator("#cap").click();

test("эфир играет по касанию", async ({ page }) => {
  await open(page);
  await tapCapsule(page);
  await expect(page.locator("#hint")).toHaveText(""); // пока голос звучит, подсказки нет
  await expect(page.locator("#track")).toHaveAttribute("data-bars", /^\d+$/); // лента голоса за овалом готова
});

test("запись: записать → опубликовать → после перезагрузки в эфире и в «Моё»", async ({ page }) => {
  await open(page);
  const mine = page.locator("#stories .st.mine");
  const before = await mine.count();

  await page.locator('#stories .st.me').click(); // «+ ты» — новая запись
  await expect(page.locator("#main")).toHaveAttribute("aria-label", "Остановить запись");
  await page.waitForTimeout(1500);
  await page.locator("#main").click();
  await expect(page.locator("#main")).toHaveAttribute("aria-label", "Опубликовать");

  await page.locator("#main").click();
  await expect(page.locator("#hint")).toContainText("Сохранено", { timeout: 5000 });
  await expect(page.locator("#hint")).toContainText("другим людям пока не отправляется");

  await page.reload();
  await expect(mine).toHaveCount(before + 1);
  // звук сохранённой записи читается с устройства, только когда она заиграет
  await mine.first().click();
  await expect(page.locator("#hint")).toHaveText("");
  await expect(page.locator("#track")).toHaveAttribute("data-bars", /^\d+$/); // лента голоса готова
});

test("сбой сети не глушит эфир: после ошибки касание пробует снова", async ({ page }) => {
  await page.route("**/seed/*.m4a", (r) => r.abort("internetdisconnected"));
  await open(page);
  await tapCapsule(page);
  await expect(page.locator("#hint")).toContainText("не загрузился", { timeout: 10_000 });

  await page.unroute("**/seed/*.m4a");
  await tapCapsule(page);
  await expect(page.locator("#hint")).toHaveText("", { timeout: 10_000 });
  await expect(page.locator("#track")).toHaveAttribute("data-bars", /^\d+$/); // лента голоса готова
});

test("свернули приложение во время записи — запись остановлена, записанное ждёт в просмотре", async ({ page }) => {
  await open(page);
  await page.locator("#stories .st.me").click();
  await expect(page.locator("#main")).toHaveAttribute("aria-label", "Остановить запись");
  await page.waitForTimeout(1200);
  await page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", { value: "hidden", configurable: true });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect(page.locator("#main")).toHaveAttribute("aria-label", "Опубликовать");
});
