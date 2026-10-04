const root = document.documentElement;
const buttons = document.querySelectorAll("[data-theme]");
const apply = (t) => {
  if (t === "auto") delete root.dataset.nbTheme; else root.dataset.nbTheme = t;
  buttons.forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.theme === t)));
  try { localStorage.setItem("nb-overview-theme", t); } catch {}
};
buttons.forEach((b) => b.addEventListener("click", () => apply(b.dataset.theme)));
try { const saved = localStorage.getItem("nb-overview-theme"); if (saved) apply(saved); } catch {}
