import basicSsl from "@vitejs/plugin-basic-ssl";
import { defineConfig, type Plugin } from "vite";
import { VitePWA } from "vite-plugin-pwa";

const LIGHT = "#E9E9E6";
// GitHub Pages отдаёт сайт из подпапки /SUSHHH/: BASE=/SUSHHH/ npm run build
const base = process.env.BASE ?? "/";

// PWA: манифест, иконки, ярлыки и service worker (Workbox).
// Оболочка — в precache: открывается мгновенно и без сети.
// Голоса и шрифты — CacheFirst по мере прослушивания; аудио отдаётся с поддержкой Range.
const pwa = VitePWA({
  registerType: "prompt", // новая версия — только с согласия, чтобы не оборвать запись
  injectRegister: false, // регистрирует src/pwa.ts
  includeAssets: ["favicon.ico", "apple-touch-icon-180x180.png", "logo.svg"],
  manifest: {
    id: base,
    name: "SUSHHH — voices you listen to",
    short_name: "SUSHHH",
    description: "Live voices, one after another. Listen and reply with your voice.",
    start_url: base,
    scope: base,
    display: "standalone",
    display_override: ["standalone", "minimal-ui"],
    orientation: "portrait",
    theme_color: LIGHT,
    background_color: LIGHT,
    categories: ["social", "music", "entertainment"],
    icons: [
      { src: "pwa-64x64.png", sizes: "64x64", type: "image/png" },
      { src: "pwa-192x192.png", sizes: "192x192", type: "image/png" },
      { src: "pwa-512x512.png", sizes: "512x512", type: "image/png" },
      { src: "maskable-icon-512x512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    // долгое нажатие на иконку (Android, десктоп)
    shortcuts: [
      { name: "Record", short_name: "Record", url: `${base}?go=record`, icons: [{ src: "pwa-192x192.png", sizes: "192x192" }] },
      { name: "Replies", short_name: "Replies", url: `${base}?go=replies`, icons: [{ src: "pwa-192x192.png", sizes: "192x192" }] },
    ],
  },
  workbox: {
    // + демо-голоса (≈1 МБ) и основные начертания шрифта: эфир играет даже в первый офлайн-запуск
    globPatterns: ["**/*.{js,css,html,svg,png,ico,wasm}", "seed/*.m4a", "assets/{inter-tight,jetbrains-mono}-{latin,cyrillic}-*-normal-*.woff2"],
    navigateFallback: `${base}index.html`,
    navigateFallbackDenylist: [/\/v2\//], // новая версия — своя страница, не старое приложение
    // страницу v2 не кэшируем: старое приложение обновляется только с согласия, и v2 застревала бы
    // в старой версии. Её скрипты с хэшем в имени кэшируются как обычно
    // сжатие голоса (Mediabunny, ≈1,7 МБ с запасным AAC) нужно только при отправке и только с сетью —
    // не качаем его при установке приложения
    globIgnores: ["**/node_modules/**/*", "v2/**", "assets/mediabunny*"],
    cleanupOutdatedCaches: true,
    runtimeCaching: [
      {
        urlPattern: ({ url, request }) => request.destination === "audio" || /\.(m4a|mp3|ogg|opus|webm|aac)$/.test(url.pathname),
        handler: "CacheFirst",
        options: {
          cacheName: "voices-v2",
          rangeRequests: true, // <audio> просит куски файла — отдаём их из кэша
          // только полные CORS-ответы: «непрозрачный» ответ из кэша плеер в CORS-режиме не примет
          cacheableResponse: { statuses: [200] },
          expiration: { maxEntries: 200, maxAgeSeconds: 7 * 24 * 60 * 60 },
        },
      },
      {
        urlPattern: ({ request }) => request.destination === "font",
        handler: "CacheFirst",
        options: { cacheName: "fonts", expiration: { maxEntries: 20, maxAgeSeconds: 365 * 24 * 60 * 60 } },
      },
    ],
  },
});

// У v2 свой манифест: «На экран Домой» со страницы /v2/ должен открывать /v2/, а не старое приложение.
// Плагин PWA вставляет общий манифест во все страницы — на v2 оставляем только свой.
const v2Manifest: Plugin = {
  name: "v2-manifest",
  enforce: "post", // после плагина PWA — он тоже «post», и вставляет ссылку раньше нас
  transformIndexHtml: {
    order: "post",
    handler: (html, ctx) =>
      ctx.path.includes("/v2/")
        ? html.replace(/<link rel="manifest" href="([^"]*)"\s*\/?>\s*/g, (tag, href: string) => (href.includes("/v2/") ? tag : ""))
        : html,
  },
};

// `npm run dev:phone` — HTTPS в локальной сети: без него телефон не даст доступ к микрофону
// Две версии рядом: старая — в корне сайта, новая «капсула» — по адресу /v2/
export default defineConfig(({ mode }) => ({
  base,
  plugins: [pwa, v2Manifest, ...(mode === "phone" ? [basicSsl()] : [])],
  // библиотеки, которые грузятся лениво (сжатие голоса, сервер), собираем заранее: иначе dev-сервер
  // пересобирает их при первом обращении и перезагружает страницу — посреди теста или записи
  // сияние (voice-glow) написано на React, а нужен ему только рендер и обычные хуки — Preact даёт то же
  // в ~10 раз меньше: v2 грузится и разбирается быстрее на телефоне
  resolve: {
    alias: {
      "react-dom/client": "preact/compat/client",
      "react-dom": "preact/compat",
      "react/jsx-runtime": "preact/jsx-runtime",
      react: "preact/compat",
    },
  },
  optimizeDeps: { include: ["mediabunny", "@mediabunny/aac-encoder", "@supabase/supabase-js"] },
  build: {
    rollupOptions: {
      input: { main: "index.html", v2: "v2/index.html" },
      output: {
        // куски Mediabunny — под узнаваемым именем, чтобы исключить их из офлайн-кэша
        chunkFileNames: (c) => (c.moduleIds.some((id) => id.includes("mediabunny")) ? "assets/mediabunny-[hash].js" : "assets/[name]-[hash].js"),
      },
    },
  },
}));
