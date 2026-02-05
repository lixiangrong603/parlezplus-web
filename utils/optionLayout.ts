export type OptionLayoutColumns = 1 | 2 | 4;

function isWideChar(char: string): boolean {
  // Rough heuristic: count CJK/fullwidth as 2 units.
  // Covers: CJK Unified Ideographs, Hiragana, Katakana, Hangul, Fullwidth forms.
  return /[\u1100-\u11FF\u2E80-\uA4CF\uAC00-\uD7AF\uF900-\uFAFF\uFE10-\uFE6F\uFF00-\uFFEF\u3040-\u30FF\u4E00-\u9FFF]/.test(char);
}

export function estimateTextUnits(text: string): number {
  let units = 0;
  for (const ch of text || '') {
    units += isWideChar(ch) ? 2 : 1;
  }
  return units;
}

/**
 * Decide how to lay out 4 options:
 * - 4 columns: one row
 * - 2 columns: two rows
 * - 1 column: four rows
 *
 * Uses a simple visual-length heuristic (CJK counted wider).
 */
export function getOptionGridColumns(optionTexts: string[]): OptionLayoutColumns {
  const texts = (optionTexts || []).map(t => (t ?? '').trim());
  if (texts.length === 0) return 4;

  // If any option is multi-line, give it full width.
  if (texts.some(t => t.includes('\n'))) return 1;

  const units = texts.map(estimateTextUnits);
  const maxUnits = Math.max(...units);
  const totalUnits = units.reduce((a, b) => a + b, 0);

  // Thresholds tuned for typical card/editor widths.
  // 4-col only when everything is short.
  if (maxUnits <= 18 && totalUnits <= 72) return 4;

  // 2-col for medium length.
  if (maxUnits <= 42 && totalUnits <= 168) return 2;

  // Otherwise stack.
  return 1;
}
