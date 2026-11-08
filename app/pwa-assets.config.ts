// Иконки PWA из public/logo.svg: `npx pwa-assets-generator`
import { defineConfig, minimal2023Preset } from "@vite-pwa/assets-generator/config";

const bg = { resizeOptions: { background: "#E8EDF4" } };

export default defineConfig({
  headLinkOptions: { preset: "2023" },
  preset: {
    ...minimal2023Preset,
    transparent: { ...minimal2023Preset.transparent, padding: 0 },
    maskable: { ...minimal2023Preset.maskable, padding: 0.1, ...bg },
    apple: { ...minimal2023Preset.apple, padding: 0.1, ...bg },
  },
  images: ["public/logo.svg"],
});
