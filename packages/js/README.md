# @newbrush/js

Optional behaviours for newBrush. Nothing in newBrush needs JavaScript (constitution §III): this only makes common
interactions nicer. All of it is ~1 kB brotli, no dependencies.

## Design styles at runtime

```js
import { setStyle, getStyle, restoreStyle } from "@newbrush/js";

restoreStyle();                                   // apply the visitor's remembered style, if any
await setStyle("neon", { transition: true, persist: true });
getStyle();                                       // "neon"
await setStyle(null);                             // back to the default style
await setStyle("default", { target: section });   // default style for one subtree inside a styled page
```

`setStyle(name, options)` swaps the style class on `target` (default `<body>`, which styles the whole page): it removes
any style class (bare, `nb-` or alias) and `data-nb-style`, then adds the new one. Aliases work (`glass`, `neumorph`,
`pixel`). Options:

| Option | Default | |
| ------ | ------- | - |
| `target` | `document.body` | Element that carries the style |
| `transition` | `false` | Animate with the View Transitions API; skipped with `prefers-reduced-motion` or without the API |
| `persist` | `false` | Remember the choice in `localStorage` (`nb-style`) for `restoreStyle()` |
| `styles` | built-ins | Your custom styles (`[{ name, aliases }]`) from `customStyles` |
| `prefix` | `""` | Your `prefix.styles` |

`getStyle(target)` returns the style in effect at an element: the `--nb-style` marker the stylesheet sets, or, before
styles load, the nearest style class or `data-nb-style` in the markup; `"default"` under `.style-default`; `null` when
none applies.
