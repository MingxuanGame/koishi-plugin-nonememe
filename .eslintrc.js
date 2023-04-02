module.exports = {
  env: {
    commonjs: true,
    es2021: true,
    node: true,
  },
  extends: [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    "plugin:jsx-a11y/recommended",
  ],
  overrides: [],
  parser: "@typescript-eslint/parser",
  parserOptions: {
    ecmaVersion: "latest",
  },
  plugins: ["@typescript-eslint", "jsx-a11y"],
};
