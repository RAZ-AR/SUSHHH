import basicSsl from "@vitejs/plugin-basic-ssl";
import { defineConfig, type Plugin } from "vite";
import { VitePWA } from "vite-plugin-pwa";

const DARK = "#0b0b0c";
// GitHub Pages отдаёт сайт из подпапки /SUSHHH/: BASE=/SUSHHH/ npm run build
const base = process.env.BASE ?? "/";

// PWA: манифест, иконки, ярлыки и service worker (Workbox).
// Оболочка — в precache: открывается мгновенно и без сети.
// Голоса и шрифты — CacheFirst по мере прослушивания; аудио отдаётся с поддержкой Range.
const pwa = VitePWA({
  registerType: "prompt", // новая версия — только с согласия, чтобы не оборвать запись
  injectRegister: false, // регистрирует v2/fresh.ts
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
    theme_color: DARK,
    background_color: DARK,
    categories: ["social", "music", "entertainment"],
    icons: [
      { src: "pwa-64x64.png", sizes: "64x64", type: "image/png" },
      { src: "pwa-192x192.png", sizes: "192x192", type: "image/png" },
      { src: "pwa-512x512.png", sizes: "512x512", type: "image/png" },
      { src: "maskable-icon-512x512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  },
  workbox: {
    // + демо-голоса (≈1 МБ) и основные начертания шрифта: эфир играет даже в первый офлайн-запуск
    globPatterns: ["**/*.{js,css,html,svg,png,ico,wasm}", "seed/*.m4a", "assets/inter-tight-{latin,cyrillic}-*-normal-*.woff2"],
    navigateFallback: `${base}index.html`,
    // страница приложения хранится вместе со своими скриптами: приложение открывается и без сети.
    // Новую версию приложение включает само (v2/fresh.ts), поэтому в старой оно не застрянет.
    // Ссылки с ?… (?thread= из уведомления) — та же страница: параметры при поиске в кэше не важны
    ignoreURLParametersMatching: [/.*/],
    // сжатие голоса (Mediabunny, ≈1,7 МБ с запасным AAC) нужно только при отправке и только с сетью —
    // не качаем его при установке приложения
    globIgnores: ["**/node_modules/**/*", "assets/mediabunny*"],
    cleanupOutdatedCaches: true,
    // уведомления «Тебе ответили голосом»: показ и касание (public/push-sw.js)
    // и включение новой версии, когда открыта только удалённая старая (public/sw-update.js)
    // и демо-голоса из кэша кусками — иначе Safari на iPhone их не играет (public/sw-media.js)
    importScripts: ["push-sw.js", "sw-update.js", "sw-media.js"],
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

// Приложение живёт в корне сайта. Старый адрес /v2/ — та же страница: с него открываются иконки,
// поставленные на экран «Домой» раньше, и уведомления, разосланные со ссылкой v2/?thread=.
// В сборке — копия готовой страницы, в разработке — тот же ответ, что и для корня.
const v2Alias: Plugin = {
  name: "v2-alias",
  enforce: "post",
  configureServer(server) {
    server.middlewares.use((req, _res, next) => {
      if (req.url && /^\/v2\/?(?:[?#]|$)/.test(req.url)) req.url = "/" + req.url.replace(/^\/v2\/?/, "");
      next();
    });
  },
  generateBundle(_, bundle) {
    const page = bundle["index.html"];
    if (page?.type === "asset") this.emitFile({ type: "asset", fileName: "v2/index.html", source: page.source });
  },
};

// `npm run dev:phone` — HTTPS в локальной сети: без него телефон не даст доступ к микрофону
export default defineConfig(({ mode }) => ({
  base,
  plugins: [pwa, v2Alias, ...(mode === "phone" ? [basicSsl()] : [])],
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
      output: {
        // куски Mediabunny — под узнаваемым именем, чтобы исключить их из офлайн-кэша
        chunkFileNames: (c) => (c.moduleIds.some((id) => id.includes("mediabunny")) ? "assets/mediabunny-[hash].js" : "assets/[name]-[hash].js"),
      },
    },
  },
}));
