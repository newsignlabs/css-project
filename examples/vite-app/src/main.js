import "./app.css";

const features = [
  [
    "Token-driven",
    "Every value comes from a W3C design token, so themes re-skin everything at once.",
  ],
  ["Utilities on demand", "Only the classes you use are generated — md:grid-cols-3 and friends."],
  ["Zero JS components", "Dialogs, accordions and tabs are native HTML with accessible defaults."],
];

document.querySelector("#features").innerHTML = features
  .map(
    ([title, body]) =>
      `<article class="feature nb-card"><h3 class="nb-card__title">${title}</h3><p class="text-muted mt-2">${body}</p></article>`,
  )
  .join("");
