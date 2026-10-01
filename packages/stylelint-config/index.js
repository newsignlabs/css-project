import noRawValues from "./plugins/no-raw-values.js";
import requireLayer from "./plugins/require-layer.js";
import useLogical from "./plugins/use-logical.js";

/** BEM-style class names: nb-card, nb-card__header, nb-btn--primary. */
const CLASS_PATTERN =
  "^[a-z][a-z0-9]*(-[a-z0-9]+)*(__[a-z0-9]+(-[a-z0-9]+)*)?(--[a-z0-9]+(-[a-z0-9]+)*)?$";

/** @type {import("stylelint").Config} */
export default {
  extends: ["stylelint-config-standard"],
  plugins: [requireLayer, useLogical, noRawValues],
  rules: {
    "nb/require-layer": true,
    "nb/use-logical": true,
    "nb/no-raw-values": [true, { lengths: false }],
    "selector-class-pattern": [
      CLASS_PATTERN,
      { message: "Use BEM-style kebab-case class names (nb-block__element--modifier)" },
    ],
    "custom-property-pattern": [
      "^(nb-[a-z0-9-]+|_[a-z0-9-]+)$",
      { message: "Custom properties must start with --nb- (or --_ for private)" },
    ],
    "import-notation": "string",
    "declaration-no-important": null,
  },
  overrides: [
    {
      files: ["**/components/**/*.css"],
      rules: {
        "declaration-no-important": true,
        "nb/no-raw-values": [true, { lengths: true }],
      },
    },
  ],
};
