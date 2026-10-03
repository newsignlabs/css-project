import { relative, resolve } from "node:path";
import { DirectiveError, expandApply } from "@newbrush/engine";
import { createProjectEngine, globBase, Scanner } from "@newbrush/engine/node";
import type { PluginCreator } from "postcss";

export interface NewBrushPostcssOptions {
  /** Project root (defaults to process.cwd()). */
  cwd?: string;
  /** Path to newbrush.config.* relative to cwd. */
  config?: string;
}

/**
 * Replaces `@newbrush utilities;` with the utilities used in `content` files and expands `@nb-apply` (T055).
 * Registers content globs and the config file as dependencies so watchers (Vite, webpack, Next) rebuild on change.
 */
const newbrush: PluginCreator<NewBrushPostcssOptions> = (options = {}) => ({
  postcssPlugin: "@newbrush/postcss",
  async Once(root, { result, postcss }) {
    let hasDirective = false;
    root.walkAtRules((at) => {
      if (at.name === "nb-apply" || (at.name === "newbrush" && at.params.trim() === "utilities"))
        hasDirective = true;
    });
    if (!hasDirective) return;

    const cwd = resolve(options.cwd ?? process.cwd());
    const { engine, config, configPath } = await createProjectEngine(cwd, options.config);
    const candidates = await new Scanner(config.content, cwd).scanAll();
    const parent = result.opts.from;

    for (const glob of config.content) {
      const pattern = glob.replace(/^\.\//, "");
      const base = globBase(pattern);
      const dir = resolve(cwd, base);
      const rest = base === "." ? pattern : pattern.slice(base.length + 1);
      if (rest)
        result.messages.push({
          type: "dir-dependency",
          plugin: "@newbrush/postcss",
          dir,
          glob: rest,
          parent,
        });
      else
        result.messages.push({
          type: "dependency",
          plugin: "@newbrush/postcss",
          file: dir,
          parent,
        });
    }
    if (configPath)
      result.messages.push({
        type: "dependency",
        plugin: "@newbrush/postcss",
        file: configPath,
        parent,
      });

    root.walkAtRules("nb-apply", (at) => {
      try {
        at.replaceWith(postcss.parse(expandApply(engine, at.params), { from: parent }).nodes);
      } catch (error) {
        if (error instanceof DirectiveError)
          throw at.error(error.message, { word: error.classes[0] });
        throw error;
      }
    });
    root.walkAtRules("newbrush", (at) => {
      if (at.params.trim() !== "utilities") return;
      const css = engine.generate(candidates, { reportUnknown: false }).css;
      at.replaceWith(
        postcss.parse(css, { from: parent ? relative(cwd, parent) : undefined }).nodes,
      );
    });
  },
});
newbrush.postcss = true;

export default newbrush;
