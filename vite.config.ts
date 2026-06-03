import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const host = process.env.TAURI_DEV_HOST;

// https://vite.dev/config/
export default defineConfig(async () => ({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: [
      { find: "@/packages/editor", replacement: "/src/editor" },
      { find: "@", replacement: "/src" },
      {
        find: "@notelab/gmail-connector/ui",
        replacement: "/src/connectors/gmail/src/ui.tsx",
      },
      {
        find: "@notelab/github-connector/ui",
        replacement: "/src/connectors/github/src/ui.tsx",
      },
      {
        find: "@notelab/google-calendar-connector/ui",
        replacement: "/src/connectors/google-calendar/src/ui.tsx",
      },
      {
        find: "@notelab/google-drive-connector/ui",
        replacement: "/src/connectors/google-drive/src/ui.tsx",
      },
      {
        find: "@notelab/linear-connector/ui",
        replacement: "/src/connectors/linear/src/ui.tsx",
      },
      {
        find: "@notelab/slack-connector/ui",
        replacement: "/src/connectors/slack/src/ui.tsx",
      },
    ],
  },

  // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
  //
  // 1. prevent Vite from obscuring rust errors
  clearScreen: false,
  // 2. tauri expects a fixed port, fail if that port is not available
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      // 3. tell Vite to ignore watching `src-tauri`
      ignored: ["**/src-tauri/**"],
    },
  },
}));
