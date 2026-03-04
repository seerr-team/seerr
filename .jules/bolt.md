
## 2026-03-04 - [Zero Tolerance for Build Error Suppression]
**Vulnerability:** Disabling TypeScript build errors (e.g., ignoreBuildErrors: true) or using 'any' to bypass type checks masks underlying architectural flaws and leads to runtime crashes.
**Action:** Never suppress build errors in configuration files. If a type conflict occurs (e.g., React 19 JSX changes), resolve the underlying types or use explicit 'unknown' with type guards. Automated PRs must pass a full 'pnpm type-check' before submission.
