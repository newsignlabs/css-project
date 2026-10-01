import stylelint from "stylelint";

const ruleName = "nb/require-layer";
const messages = stylelint.utils.ruleMessages(ruleName, {
  rejected: (what) => `${what} must be inside an "@layer nb.*" block (constitution §I)`,
  badName: (name) => `Layer "${name}" must be named "nb.*"`,
});

function insideNbLayer(node) {
  for (let p = node.parent; p && p.type !== "root"; p = p.parent) {
    if (p.type === "atrule" && p.name === "layer") return true;
  }
  return false;
}

const ruleFunction = (primary) => (root, result) => {
  if (!stylelint.utils.validateOptions(result, ruleName, { actual: primary })) return;

  root.walkAtRules("layer", (node) => {
    for (const name of node.params
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)) {
      if (!name.startsWith("nb.") && name !== "nb") {
        stylelint.utils.report({ ruleName, result, node, message: messages.badName(name) });
      }
    }
  });

  root.walkRules((node) => {
    if (node.parent?.type === "atrule" && node.parent.name === "keyframes") return;
    if (!insideNbLayer(node)) {
      stylelint.utils.report({
        ruleName,
        result,
        node,
        message: messages.rejected(`Rule "${node.selector}"`),
      });
    }
  });

  root.walkDecls((node) => {
    if (node.parent?.type === "root") {
      stylelint.utils.report({
        ruleName,
        result,
        node,
        message: messages.rejected(`Declaration "${node.prop}"`),
      });
    }
  });
};

ruleFunction.ruleName = ruleName;
ruleFunction.messages = messages;
ruleFunction.meta = {
  url: "https://github.com/newsignlabs/css-project/blob/main/.specify/memory/constitution.md",
};

export default stylelint.createPlugin(ruleName, ruleFunction);
