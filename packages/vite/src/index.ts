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
  let styleFiles = new Set<string>();
  const cssModules = new Set<string>();

  async function setup(): Promise<void> {
    const project = await createProjectEngine(root, options.config);
    engine = project.engine;
    styleFiles = new Set(project.styleFiles);
    scanner = new Scanner(project.config.content, root);
    const match = picomatch(project.config.content.map((g) => g.replace(/^\.\//, "")));
    isContent = (file) => match(relative(root, file).split(sep).join("/"));
    engine.addCandidates(await scanner.scanAll());
  }

  /** Re-runs the stylesheets that use directives (their output depends on the engine). */
  async function reloadCss(server: ViteDevServer): Promise<void> {
    for (const id of cssModules) {
      const mod = server.moduleGraph.getModuleById(id);
      if (!mod) continue;
      server.moduleGraph.invalidateModule(mod);
      await server.reloadModule(mod);
    }
  }

  async function onContentChange(server: ViteDevServer, file: string): Promise<void> {
    await ready;
    // A custom style changed (specs/004 T030): rebuild the engine, then the stylesheets.
    if (styleFiles.has(file)) {
      ready = setup();
      await ready;
      await reloadCss(server);
      return;
    }
    if (!engine || !scanner || !isContent(file)) return;
    const start = performance.now();
    const fresh = await scanner.update(file);
    if (!engine.addCandidates(fresh).changed) return;
    await reloadCss(server);
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
    async buildStart() {
      await ready;
      if (!engine) return;
      const contrast = engine.contrastVerdict();
      for (const message of contrast.messages) this.warn(`contrast: ${message}`);
      if (contrast.fail)
        this.error(
          `semantic colours fail ${engine.contrast.level} contrast (contrast.onFail: "error")`,
        );
    },
    async transform(code, id) {
      if (!CSS.test(id) || !hasDirectives(code)) return null;
      await ready;
      if (!engine || !scanner) return null;
      cssModules.add(id);
      return { code: processDirectives(code, engine, scanner.candidates()).css, map: null };
    },
    // Config `styles` (specs/004 T028): the built CSS keeps only the design styles the config includes. The dev
    // server keeps them all (it is a size optimisation, not a behaviour change).
    generateBundle(_, bundle) {
      if (!engine) return;
      for (const file of Object.values(bundle))
        if (file.type === "asset" && file.fileName.endsWith(".css"))
          file.source = engine.selectStyles(String(file.source));
    },
    configureServer(server) {
      for (const event of ["add", "change"] as const)
        server.watcher.on(event, (file) => void onContentChange(server, file));
      void ready.then(() => server.watcher.add([...styleFiles]));
    },
  };
}
