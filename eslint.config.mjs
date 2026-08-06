import js from "@eslint/js";
import tseslint from "typescript-eslint";
import eslintConfigPrettier from "eslint-config-prettier";

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  eslintConfigPrettier,
  {
    ignores: [
      "**/dist/**",
      "**/.turbo/**",
      "**/node_modules/**",
      "**/.next/**",
      "**/next-env.d.ts",
      // Vite writes a transient `*.timestamp-*.mjs` next to its config while it
      // loads it during a build; it is deleted immediately after. When turbo
      // runs `lint` and `build` concurrently, ESLint's glob can catch it mid-
      // flight and fail with ENOENT — it is a generated artifact, never source.
      "**/*.timestamp-*.mjs",
    ],
  },
);
