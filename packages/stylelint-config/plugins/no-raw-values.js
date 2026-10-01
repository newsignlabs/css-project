import stylelint from "stylelint";

const ruleName = "nb/no-raw-values";
const messages = stylelint.utils.ruleMessages(ruleName, {
  color: (v) => `Raw color "${v}" — use a --nb-color-* token (constitution §II)`,
  length: (v) =>
    `Raw length "${v}" — use a --nb-space-*/--nb-radius-*/--nb-size-* token (constitution §II)`,
});

const COLOR_FN = /\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\(/i;
const HEX = /#[0-9a-f]{3,8}\b/i;
// Named colors are deliberately not exhaustive: the common ones catch most mistakes without false positives.
const NAMED =
  /(?<![-\w])(?:black|white|red|green|blue|gray|grey|orange|yellow|purple|pink|brown|navy|teal|silver|maroon|olive|lime|aqua|fuchsia)(?![-\w])/i;
// Lengths allowed as-is: zero and hairlines.
const LENGTH = /(?<![-\w.])(-?\d*\.?\d+)(px|rem)\b/gi;
const ALLOWED_LENGTHS = new Set(["1px", "-1px", "2px"]);

const ruleFunction =
  (primary, secondary = {}) =>
  (root, result) => {
    const valid = stylelint.utils.validateOptions(
      result,
      ruleName,
      { actual: primary },
      { actual: secondary, possible: { lengths: [true, false] }, optional: true },
    );
    if (!valid) return;
    const checkLengths = secondary.lengths === true;

    root.walkDecls((node) => {
      // Custom property definitions are where tokens are declared; only consumption is checked.
      if (node.prop.startsWith("--")) return;
      const value = node.value.replace(/var\([^)]*\)/g, "var()");
      const color =
        value.match(HEX)?.[0] ?? (COLOR_FN.test(value) ? value : null) ?? value.match(NAMED)?.[0];
      if (color && !/^color-mix\(/i.test(value.trim()) && !/\bfrom\s+var\(/i.test(node.value)) {
        stylelint.utils.report({ ruleName, result, node, message: messages.color(color) });
      }
      if (checkLengths) {
        for (const m of value.matchAll(LENGTH)) {
          if (Number(m[1]) === 0 || ALLOWED_LENGTHS.has(m[0])) continue;
          stylelint.utils.report({ ruleName, result, node, message: messages.length(m[0]) });
        }
      }
    });
  };

ruleFunction.ruleName = ruleName;
ruleFunction.messages = messages;
ruleFunction.meta = {
  url: "https://github.com/newsignlabs/css-project/blob/main/.specify/memory/constitution.md",
};

export default stylelint.createPlugin(ruleName, ruleFunction);
