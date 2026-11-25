// The newBrush stylesheets, bundled as text (tsup `loader: { ".css": "text" }`; vitest.config.ts does the same).
declare module "newbrush/css" {
  const css: string;
  export default css;
}
declare module "newbrush/core.css" {
  const css: string;
  export default css;
}
declare module "newbrush/themes/*.css" {
  const css: string;
  export default css;
}
