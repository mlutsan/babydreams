import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import pluginReact from "eslint-plugin-react";
import stylistic from "@stylistic/eslint-plugin";
import unusedImports from "eslint-plugin-unused-imports";

export default [
  {
    ignores: ["./dist/*"]
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  pluginReact.configs.flat.recommended,
  {
    files: ["**/*.{js,mjs,cjs,ts,mts,cts,jsx,tsx}"],
    plugins: {
      "@stylistic": stylistic,
      "unused-imports": unusedImports,
    },
    languageOptions: {
      globals: { ...globals.browser, ...globals.node }
    },
    settings: {
      react: {
        version: "detect"
      }
    },
    rules: {
      // Disable react-in-jsx-scope for React 17+ (new JSX transform)
      "react/react-in-jsx-scope": "off",
      "react/jsx-uses-react": "off",

      // Add your stylistic rules here
      "@stylistic/indent": ["warn", 2],
      "@stylistic/quotes": ["warn", "double"],
      "@stylistic/semi": ["error", "always"],
      "@typescript-eslint/no-empty-object-type": "off",
      "no-unused-vars": "off", // or "@typescript-eslint/no-unused-vars": "off",
      "unused-imports/no-unused-imports": "error",
      "unused-imports/no-unused-vars": [
        "warn",
        {
          "vars": "all",
          "varsIgnorePattern": "^_",
          "args": "after-used",
          "argsIgnorePattern": "^_",
        },
      ]
    }
  }
];
