---
"@newbrush/mcp": minor
---

New tools `create_theme` (brand seeds plus radius, density and font → light, dark and high-contrast token CSS with a
WCAG/APCA contrast report, auto-adjusted unless `strict`, and a `themeId` that `generate_css` and `build_page` accept)
and `validate_markup` (unknown classes, component anatomy, accessibility quick checks and colour-utility contrast, with
line and column). `restyle_with_brand` now uses both.
