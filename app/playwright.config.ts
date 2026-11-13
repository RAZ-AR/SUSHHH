// Сквозные тесты в настоящем браузере: `npm run e2e`.
// Микрофон поддельный — Chromium подаёт в него ровный тон, поэтому запись не «молчит».
import { defineConfig, devices } from "@playwright/test";

const PORT = 4180;

export default defineConfig({
  testDir: "e2e",
  timeout: 60_000, // первый тест ждёт, пока dev-сервер соберёт страницу
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    ...devices["Pixel 7"],
    baseURL: `http://localhost:${PORT}`,
    permissions: ["microphone"],
    locale: "ru-RU", // тесты проверяют русские тексты; язык приложение берёт из системы
    launchOptions: { args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream", "--autoplay-policy=no-user-gesture-required"] },
    trace: "retain-on-failure",
  },
  webServer: {
    command: `npx vite --port ${PORT} --strictPort`,
    port: PORT,
    reuseExistingServer: !process.env.CI,
  },
});
