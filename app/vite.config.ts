import basicSsl from "@vitejs/plugin-basic-ssl";
import { defineConfig } from "vite";

// `npm run dev:phone` — HTTPS в локальной сети: без него телефон не даст доступ к микрофону
export default defineConfig(({ mode }) => ({
  plugins: mode === "phone" ? [basicSsl()] : [],
}));
