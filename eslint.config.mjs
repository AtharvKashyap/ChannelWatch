import js from "@eslint/js";
import tseslint from "typescript-eslint";
import eslintConfigPrettier from "eslint-config-prettier";

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  eslintConfigPrettier,
  {
    // Node-runtime config files authored as ESM `.mjs` (e.g. next.config.mjs).
    // Unlike the `.ts` configs (where typescript-eslint disables `no-undef`
    // because the compiler checks globals), these are linted as plain JS, so
    // declare the Node/Web globals they legitimately use.
    files: ["**/*.config.mjs", "**/*.config.js"],
    languageOptions: {
      globals: {
        process: "readonly",
        URL: "readonly",
        console: "readonly",
        __dirname: "readonly",
        module: "readonly",
        require: "readonly",
      },
    },
  },
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
