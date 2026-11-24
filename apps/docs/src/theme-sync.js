// Runs in <head> before first paint.
// - Mirrors Starlight's resolved theme (data-theme on <html>) to newBrush's data-nb-theme, now and on every change.
// - Restores the design style chosen in the header (specs/004 T034) from localStorage, so pages never flash unstyled.
(() => {
  const root = document.documentElement;
  const sync = () =>
    root.setAttribute("data-nb-theme", root.dataset.theme === "light" ? "light" : "dark");
  sync();
  new MutationObserver(sync).observe(root, { attributes: true, attributeFilter: ["data-theme"] });
  const styles = /*STYLES*/ [];
  try {
    const style = localStorage.getItem("nb-style");
    if (style && styles.includes(style)) root.setAttribute("data-nb-style", style);
  } catch {
    // Storage can be blocked (private mode, policies): keep the default style.
  }
})();
