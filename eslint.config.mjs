import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // Plain <a> links are deliberate here: the admin dashboard has its own root layout (a full page load is the point),
    // and the error pages must work where client navigation is not loaded. With the catch-all 404 route in place,
    // this rule would flag every internal link.
    rules: { "@next/next/no-html-link-for-pages": "off" },
  },
  globalIgnores([
    ".next/**", "out/**", "build/**", "next-env.d.ts",
    // The owner's Super Admin dashboard, vendored as written (DECISIONS.md D1).
    "src/legacy/**",
  ]),
]);
