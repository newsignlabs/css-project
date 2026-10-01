import stylelint from "stylelint";

const ruleName = "nb/use-logical";
const messages = stylelint.utils.ruleMessages(ruleName, {
  property: (prop, alt) => `Use logical "${alt}" instead of physical "${prop}" (FR-007)`,
  value: (prop, value, alt) => `Use "${prop}: ${alt}" instead of "${prop}: ${value}" (FR-007)`,
});

const SIDES = {
  top: "block-start",
  bottom: "block-end",
  left: "inline-start",
  right: "inline-end",
};

/** Maps a physical property to its logical equivalent, or null when it is not direction-sensitive. */
export function logicalAlternative(prop) {
  const p = prop.toLowerCase();
  if (p in SIDES) return `inset-${SIDES[p]}`;
  let m = /^(margin|padding|scroll-margin|scroll-padding)-(top|bottom|left|right)$/.exec(p);
  if (m) return `${m[1]}-${SIDES[m[2]]}`;
  m = /^border-(top|bottom|left|right)(-width|-style|-color)?$/.exec(p);
  if (m) return `border-${SIDES[m[1]]}${m[2] ?? ""}`;
  m = /^border-(top|bottom)-(left|right)-radius$/.exec(p);
  if (m)
    return `border-${m[1] === "top" ? "start" : "end"}-${m[2] === "left" ? "start" : "end"}-radius`;
  return null;
}

const VALUE_PROPS = { "text-align": true, float: true, clear: true };
const VALUE_MAP = { left: "start", right: "end" };

const ruleFunction = (primary) => (root, result) => {
  if (!stylelint.utils.validateOptions(result, ruleName, { actual: primary })) return;
  root.walkDecls((node) => {
    if (node.prop.startsWith("--")) return;
    const alt = logicalAlternative(node.prop);
    if (alt) {
      stylelint.utils.report({
        ruleName,
        result,
        node,
        message: messages.property(node.prop, alt),
      });
      return;
    }
    const value = node.value.trim().toLowerCase();
    if (VALUE_PROPS[node.prop.toLowerCase()] && value in VALUE_MAP) {
      const mapped = node.prop === "text-align" ? VALUE_MAP[value] : `inline-${VALUE_MAP[value]}`;
      stylelint.utils.report({
        ruleName,
        result,
        node,
        message: messages.value(node.prop, value, mapped),
      });
    }
  });
};

ruleFunction.ruleName = ruleName;
ruleFunction.messages = messages;
ruleFunction.meta = {
  url: "https://github.com/newsignlabs/css-project/blob/main/specs/001-core-framework/spec.md",
};

export default stylelint.createPlugin(ruleName, ruleFunction);
