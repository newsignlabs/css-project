import type { Family } from "../types.ts";
import { border } from "./border.ts";
import { color } from "./color.ts";
import { effects } from "./effects.ts";
import { flexgrid } from "./flexgrid.ts";
import { layout } from "./layout.ts";
import { motion } from "./motion.ts";
import { sizing } from "./sizing.ts";
import { spacing } from "./spacing.ts";
import { typography } from "./typography.ts";

/** Registry order is cascade order within a variant group: shorthands precede longhands (constitution §VII). */
export const families: Family[] = [
  ...layout,
  ...flexgrid,
  ...spacing,
  ...sizing,
  ...typography,
  ...color,
  ...border,
  ...effects,
  ...motion,
];
