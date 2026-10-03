import { relative, sep } from "node:path";
import { type Engine, hasDirectives, processDirectives } from "@newbrush/engine";
import { createProjectEngine, Scanner } from "@newbrush/engine/node";
import picomatch from "picomatch";
import type { Plugin, ViteDevServer } from "vite";

export interface UpdateEvent {
  /** Time from the content change to the stylesheet being invalidated and reloaded. */
  ms: number;
  file: string;
  /** Number of utilities now in use. */
  classes: number;
}

export interface NewBrushViteOptions {
  /** Path to newbrush.config.* relative to the Vite root. */
  config?: string;
  /** Called after each hot update (instrumentation, tests). */
  onUpdate?: (event: UpdateEvent) => void;
}

const CSS = /\.css(?:$|\?)/;

/** Vite plugin (T056): on-demand utilities, @nb-apply, and HMR that only touches stylesheets using directives. */
export default function newbrush(options: NewBrushViteOptions = {}): Plugin {
  let root = process.cwd();
  let ready: Promise<void> = Promise.resolve();
  let engine: Engine | undefined;
  let scanner: Scanner | undefined;
  let isContent: (file: string) => boolean = () => false;
  const cssModules = new Set<string>();

  async function setup(): Promise<void> {
    const project = await createProjectEngine(root, options.config);
    engine = project.engine;
    scanner = new Scanner(project.config.content, root);
    const match = picomatch(project.config.content.map((g) => g.replace(/^\.\//, "")));
    isContent = (file) => match(relative(root, file).split(sep).join("/"));
    engine.addCandidates(await scanner.scanAll());
  }

  async function onContentChange(server: ViteDevServer, file: string): Promise<void> {
    await ready;
    if (!engine || !scanner || !isContent(file)) return;
    const start = performance.now();
    const fresh = await scanner.update(file);
    if (!engine.addCandidates(fresh).changed) return;
    for (const id of cssModules) {
      const mod = server.moduleGraph.getModuleById(id);
      if (!mod) continue;
      server.moduleGraph.invalidateModule(mod);
      await server.reloadModule(mod);
    }
    options.onUpdate?.({
      ms: performance.now() - start,
      file,
      classes: engine.usedClasses().length,
    });
  }

  return {
    name: "@newbrush/vite",
    enforce: "pre",
    configResolved(config) {
      root = config.root;
      ready = setup();
    },
    async transform(code, id) {
      if (!CSS.test(id) || !hasDirectives(code)) return null;
      await ready;
      if (!engine || !scanner) return null;
      cssModules.add(id);
      return { code: processDirectives(code, engine, scanner.candidates()).css, map: null };
    },
    configureServer(server) {
      for (const event of ["add", "change"] as const)
        server.watcher.on(event, (file) => void onContentChange(server, file));
    },
  };
}
