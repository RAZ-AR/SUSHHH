// v2 «капсула»: эфир играет, запись доходит до «Моё» и переживает перезагрузку, сбой сети не глушит эфир.
import { expect, test, type Page } from "@playwright/test";

const open = async (page: Page) => {
  await page.goto("/");
  await expect(page.locator("#hint")).toHaveText("коснись — и эфир заиграет");
};
// согласие на запись уже дано и подсказка жестов уже показана (init-скрипты повторяются при каждой загрузке,
// поэтому в тесте удаления эти два ключа после перезагрузки снова есть) — кроме тестов, которые проверяют сам лист согласия
const CONSENT = "sushhh.v2.consent";
test.beforeEach(async ({ page }) => {
  await page.addInitScript((k) => localStorage.setItem(k, JSON.stringify({ v: 2, at: 0 })), CONSENT);
  await page.addInitScript(() => localStorage.setItem("sushhh.v2.tips", "1")); // подсказка жестов уже показана
  // настоящий сервер тесты не трогают: без него v2 работает на устройстве, записи ждут в очереди
  await page.route(/supabase\.co/, (r) => r.abort("internetdisconnected"));
});
const noConsent = (page: Page) => page.addInitScript((k) => localStorage.removeItem(k), CONSENT);

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
  await expect(page.locator("#hint")).toContainText("уйдёт в эфир, когда появится связь");

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

test("жалоба убирает голос, блокировка — автора; всё переживает перезагрузку и возвращается из «Моё»", async ({ page }) => {
  await open(page);
  const first = (await page.locator("#who").textContent())!;

  // жалоба «автору нужна помощь»: экран с тем, что делать при опасности, голос пропал
  await page.locator("#more").click();
  await page.locator('[data-act="mod-report"]').click();
  await page.locator('[data-act="mod-reason"][data-id="crisis"]').click();
  await expect(page.locator("#sheet")).toContainText("112");
  await page.locator('[data-act="mod-done"]').click();
  await expect(page.locator("#who")).not.toHaveText(first);

  // блокировка автора следующего голоса
  const second = (await page.locator("#who").textContent())!;
  await page.locator("#more").click();
  await page.locator('[data-act="mod-block"]').click();
  await page.locator('[data-act="mod-block-yes"]').click();
  await expect(page.locator("#hint")).toContainText(second);

  await page.reload();
  const names = page.locator("#stories .st .nm");
  await expect(names).not.toContainText([first]);
  await expect(names).not.toContainText([second]);

  // вернуть автора из «Моё»
  await page.locator(".dock-tab").nth(1).click();
  await page.locator(`[data-act="unblock"][data-id="${second}"]`).click();
  await page.locator(".dock-tab").nth(0).click();
  await expect(names.filter({ hasText: second })).toHaveCount(1);
});

test("первая запись: сначала согласие и возраст, потом запись; второй раз не спрашивает", async ({ page }) => {
  await noConsent(page);
  await open(page);
  await page.locator("#stories .st.me").click();
  const yes = page.locator("#consentYes");
  await expect(yes).toBeDisabled(); // без подтверждения возраста записывать нельзя
  await expect(page.locator("#main")).not.toHaveAttribute("aria-label", "Остановить запись");
  await page.locator("#age").check();
  await yes.click();
  await expect(page.locator("#main")).toHaveAttribute("aria-label", "Остановить запись");
  // согласие запомнено с версией правил — в следующий раз запись начнётся сразу
  expect(JSON.parse((await page.evaluate((k) => localStorage.getItem(k), CONSENT))!)).toMatchObject({ v: 2 });
  await page.locator("#back").click();
  await page.locator("#stories .st.me").click();
  await expect(page.locator("#sheet")).not.toHaveClass(/open/); // лист согласия не открылся
  await expect(page.locator("#main")).toHaveAttribute("aria-label", "Остановить запись");
});

test("«Удалить все мои данные» стирает записи, блокировки и согласие", async ({ page }) => {
  await open(page);
  // своя запись и заблокированный автор
  await page.locator("#stories .st.me").click();
  await page.waitForTimeout(1200);
  await page.locator("#main").click();
  await page.locator("#main").click();
  await expect(page.locator("#hint")).toContainText("Сохранено", { timeout: 5000 });
  await page.evaluate(() => localStorage.setItem("sushhh.v2.blocked", JSON.stringify(["мандарин"])));

  await page.locator(".dock-tab").nth(1).click();
  await page.locator('[data-act="erase"]').click();
  // после удаления приложение начинается заново — ждём именно новую загрузку страницы
  await Promise.all([page.waitForEvent("load"), page.locator('[data-act="erase-yes"]').click()]);
  await expect(page.locator("#hint")).toHaveText("коснись — и эфир заиграет");

  const left = await page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith("sushhh.v2.") && k !== "sushhh.v2.consent" && k !== "sushhh.v2.tips"));
  expect(left).toEqual([]);
  await expect(page.locator("#stories .st.mine")).toHaveCount(0);
  await expect(page.locator("#stories .st .nm").filter({ hasText: "мандарин" })).toHaveCount(1);
});

test("подсказка жестов: при первом запуске, закрывается и больше не показывается", async ({ page }) => {
  await page.addInitScript(() => localStorage.removeItem("sushhh.v2.tips"));
  await open(page);
  const coach = page.locator("#coach");
  await expect(coach).toBeVisible();
  await expect(coach).toContainText("Смахни вверх или вниз");
  await page.locator("#coachOk").click();
  await expect(coach).toBeHidden();
  expect(await page.evaluate(() => localStorage.getItem("sushhh.v2.tips"))).toBe("1");
});

test("кнопки для экранного диктора листают голоса и ставят паузу", async ({ page }) => {
  await open(page);
  const who = page.locator("#who");
  const first = await who.textContent();
  await page.locator("#srNext").focus();
  await page.keyboard.press("Enter");
  await expect(who).not.toHaveText(first!);
  await expect(page.locator("#srPlay")).toHaveText("Пауза");
  // кнопки невидимы, пока на них нет фокуса, — нажимаем как с клавиатуры
  await page.locator("#srPlay").focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("#srPlay")).toHaveText("Слушать");
});

test("чёткий режим: включается по системной настройке контраста и кнопкой в «Моё»", async ({ page }) => {
  await page.emulateMedia({ contrast: "more" });
  await open(page);
  const html = page.locator("html");
  await expect(html).toHaveAttribute("data-solid", "");
  // кнопка в «Моё» выключает вопреки системе и запоминает выбор
  await page.locator(".dock-tab").nth(1).click();
  const btn = page.locator('[data-act="solid"]');
  await expect(btn).toHaveAttribute("aria-pressed", "true");
  await btn.click();
  await expect(html).not.toHaveAttribute("data-solid", "");
  await page.reload();
  await expect(html).not.toHaveAttribute("data-solid", "");
  // включили вручную — стекло без размытия
  await page.emulateMedia({ contrast: "no-preference" });
  await page.locator(".dock-tab").nth(1).click();
  await page.locator('[data-act="solid"]').click();
  await expect(html).toHaveAttribute("data-solid", "");
  expect(await page.locator(".dock-bar").evaluate((e) => getComputedStyle(e).backdropFilter)).toBe("none");
});

test("языки голосов: выбираются в листе каналов, последний выключить нельзя", async ({ page }) => {
  await open(page);
  await page.locator("#chan").click();
  const ru = page.locator('[data-act="lang"][data-id="ru"]');
  const en = page.locator('[data-act="lang"][data-id="en"]');
  await expect(ru).toHaveAttribute("aria-pressed", "true"); // язык интерфейса
  await expect(en).toHaveAttribute("aria-pressed", "false");
  await en.click();
  await expect(page.locator('[data-act="lang"][data-id="en"]')).toHaveAttribute("aria-pressed", "true");
  await page.locator('[data-act="lang"][data-id="ru"]').click();
  await page.locator('[data-act="lang"][data-id="en"]').click(); // последний — остаётся
  await expect(page.locator('[data-act="lang"][data-id="en"]')).toHaveAttribute("aria-pressed", "true");
  expect(await page.evaluate(() => localStorage.getItem("sushhh.v2.langs"))).toBe('["en"]');
});

test("название голоса: пишется перед публикацией и видно в эфире после перезагрузки", async ({ page }) => {
  await open(page);
  const name = page.locator("#name");
  await expect(name).toBeHidden(); // в эфире поля нет

  await page.locator("#stories .st.me").click();
  await page.waitForTimeout(1200);
  await page.locator("#main").click();
  await expect(name).toBeVisible();
  await expect(name).toHaveAttribute("placeholder", "Назови голос (необязательно)");
  await name.fill("  про   утро и кофе  ");
  await name.press("Enter"); // «Готово» прячет клавиатуру и ничего не публикует
  await expect(page.locator("#main")).toHaveAttribute("aria-label", "Опубликовать");

  await page.locator("#main").click();
  await expect(page.locator("#hint")).toContainText("Сохранено", { timeout: 5000 });
  await expect(name).toBeHidden();

  await page.reload();
  await page.locator("#stories .st.mine").first().click();
  await expect(page.locator("#hook")).toHaveText("про утро и кофе");
});

test("прежний адрес /v2/ открывает то же приложение (старые иконки и уведомления)", async ({ page }) => {
  await page.goto("/v2/?from=old#x"); // ?thread= приложение само убирает, открыв ветку, — берём любой другой
  await expect(page).toHaveURL(/\/v2\/\?from=old#x$/);
  await expect(page.locator("#cap")).toBeVisible();
});

// iPhone, приложение с экрана «Домой»: окно короче экрана на статус-бар (873 из 932). Овал тянется
// на весь экран — и страница вокруг него не должна обрезать низ с доком
test.describe("с экрана «Домой» на iPhone", () => {
  test.use({
    userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
    viewport: { width: 430, height: 873 },
    screen: { width: 430, height: 932 },
  });
  test("экран не обрезан снизу: док целиком внутри страницы", async ({ page }) => {
    await page.addInitScript(() => Object.defineProperty(navigator, "standalone", { get: () => true }));
    await open(page);
    const box = await page.evaluate(() => {
      const r = (s: string) => document.querySelector(s)!.getBoundingClientRect();
      return { body: r("body").height, stage: r("#stage").height, dock: r(".dock").bottom };
    });
    expect(box.stage).toBe(932);
    expect(box.body).toBe(932);
    expect(box.dock).toBeLessThanOrEqual(932);
    expect(box.dock).toBeGreaterThan(873); // док прижат к низу экрана, а не к низу окна
  });
});
