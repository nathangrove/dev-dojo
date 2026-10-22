import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";
import { defineConfig, globalIgnores } from "eslint/config";

export default defineConfig([
  globalIgnores(["dist", "node_modules", "coverage"]),
  {
    files: ["**/*.{ts,tsx}"],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs["recommended-latest"],
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.browser,
    },
  },
  {
    // Tool adapters intentionally co-locate their Stage component with the
    // tool object; they are not component-only modules.
    files: ["src/lib/tools/*/tool.tsx"],
    rules: {
      "react-refresh/only-export-components": "off",
    },
  },
  {
    // Markdownish exports a helper (renderTagline) alongside the component.
    files: ["src/components/Markdownish.tsx"],
    rules: {
      "react-refresh/only-export-components": "off",
    },
  },
]);
