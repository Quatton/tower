import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { defineConfig } from "vite";
import tsConfigPaths from "vite-tsconfig-paths";
import { analyzer } from "vite-bundle-analyzer";
import react from "@vitejs/plugin-react";

export default defineConfig({
  server: {
    port: 3022,
    allowedHosts: ["localhost", "tower.qttn.dev"],
  },
  plugins: [
    tsConfigPaths(),
    tanstackStart({
      customViteReactPlugin: true,
    }),
    react(),
    analyzer({
      analyzerPort: 7777,
    }),
  ],
});
