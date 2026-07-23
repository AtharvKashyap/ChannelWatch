// React 19 test-environment flag: tells React that updates are wrapped in
// act(...) so its warnings stay quiet and batching matches production. Mirrors
// the extension's test setup (apps/extension/tests/setup/react-act.ts).
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
