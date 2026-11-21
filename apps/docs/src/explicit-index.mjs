// @ts-check
import { readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import * as pagefind from "pagefind";

/**
 * Catalyst Slate serves the site as plain static files and does not map a folder URL (/site/components/button/) to its
 * index.html, so after the build every internal folder link is rewritten to name the file
 * (/site/components/button/index.html), and the search index is rebuilt to keep index.html in result URLs.
 * Runs after Starlight's own Pagefind step, so it overwrites that index.
 * @param {string} base The site base, e.g. "/site".
 * @returns {import("astro").AstroIntegration}
 */
export default function explicitIndex(base) {
  // Internal folder links: root-relative under the base, or relative (./components/, ../../reference/themes/).
  const folderLink = new RegExp(
    `(\\s(?:href|src)=")((?:${base}/|\\.{1,2}/)(?:[^"#?:]*/)?)((?:[?#][^"]*)?")`,
    "g",
  );
  return {
    name: "newbrush:explicit-index",
    hooks: {
      "astro:build:done": async ({ dir, logger }) => {
        const root = fileURLToPath(dir);
        /** @type {(d: string) => string[]} */
        const html = (d) =>
          readdirSync(d).flatMap((name) => {
            const path = `${d}/${name}`;
            if (statSync(path).isDirectory()) return name === "pagefind" ? [] : html(path);
            return name.endsWith(".html") ? [path] : [];
          });
        let links = 0;
        for (const file of html(root.replace(/\/$/, ""))) {
          const before = readFileSync(file, "utf8");
          const after = before.replace(
            folderLink,
            (
              _,
              /** @type {string} */ attr,
              /** @type {string} */ path,
              /** @type {string} */ rest,
            ) => {
              links++;
              return `${attr}${path}index.html${rest}`;
            },
          );
          if (after !== before) writeFileSync(file, after);
        }
        rmSync(new URL("./pagefind/", dir), { recursive: true, force: true });
        const { index } = await pagefind.createIndex({ keepIndexUrl: true });
        if (!index) throw new Error("Pagefind could not create an index");
        await index.addDirectory({ path: root });
        await index.writeFiles({ outputPath: fileURLToPath(new URL("./pagefind/", dir)) });
        await pagefind.close();
        logger.info(`Rewrote ${links} folder links to index.html and rebuilt the search index.`);
      },
    },
  };
}
