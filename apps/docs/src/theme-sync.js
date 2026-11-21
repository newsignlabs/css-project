// Mirrors Starlight's resolved theme (data-theme on <html>) to newBrush's data-nb-theme, now and on every change.
(() => {
  const root = document.documentElement;
  const sync = () =>
    root.setAttribute("data-nb-theme", root.dataset.theme === "light" ? "light" : "dark");
  sync();
  new MutationObserver(sync).observe(root, { attributes: true, attributeFilter: ["data-theme"] });
})();
