import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

// Component tests render into jsdom with the same react-dom/client + act(...)
// harness the extension uses (tests/setup/react-act.ts), so no extra testing
// library is pulled in — the presentational components are plain React.
export default defineConfig({
  plugins: [react()],
  test: {
    include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"],
    environment: "jsdom",
    setupFiles: ["tests/setup/react-act.ts"],
  },
});
