import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const rootDir = dirname(fileURLToPath(import.meta.url));

// Deployed to GitHub Pages under /dev-dojo/. HashRouter means no server-side
// rewrite rules are needed for deep links.
export default defineConfig({
  base: "/dev-dojo/",
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": `${rootDir}/src`,
    },
  },
});
