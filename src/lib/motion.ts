import type { Easing } from 'framer-motion';

/**
 * The project's standard ease-out curve, used by page and list transitions.
 *
 * Declared as `Easing` rather than written inline. A bare `[0.22, 1, 0.36, 1]`
 * literal widens to `number[]`, and framer-motion's `Variants` requires the
 * four-element tuple — so inline copies fail to type-check inside a typed
 * variants object while looking identical to the ones that pass.
 */
export const EASE_OUT_EXPO: Easing = [0.22, 1, 0.36, 1];
