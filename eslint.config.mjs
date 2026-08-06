import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

/**
 * There used to be two config files: this one and a legacy `.eslintrc.json`.
 * ESLint 9 reads flat config only, so every override in the .eslintrc — including
 * `react-hooks/exhaustive-deps: off` — was silently doing nothing, and `npm run
 * lint` reported 179 problems nobody was looking at. That file is gone; the
 * overrides that were actually wanted live here, each with a reason.
 */
const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "out/**",
      "build/**",
      "next-env.d.ts",
    ],
  },
  {
    rules: {
      // The Firebase Admin SDK is exported as `any` (see lib/firebase/admin.ts)
      // and Firestore documents are untyped by nature, so `any` is load-bearing
      // in the data layer. Worth revisiting behind proper converters; not worth
      // 130 inline disable comments today.
      "@typescript-eslint/no-explicit-any": "off",

      // Cosmetic, and apostrophes in candidate-facing copy are everywhere.
      "react/no-unescaped-entities": "off",

      // Useful signal, but not a reason to fail a build.
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrors: "none" },
      ],

      // This one is the reason the file exists. It was switched off, and the
      // bug it catches — an effect closing over stale state because the value
      // is missing from its dependency array — is exactly what made an
      // auto-submitted exam grade an empty answer sheet. A warning rather than
      // an error, because several effects here omit dependencies deliberately
      // (re-registering them on every keystroke would break the behaviour) and
      // those carry a comment explaining why.
      "react-hooks/exhaustive-deps": "warn",
    },
  },
];

export default eslintConfig;
