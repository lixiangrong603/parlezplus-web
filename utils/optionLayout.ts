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

function normalizeOptionText(raw: string): string {
  const text = (raw ?? '').toString();
  // Treat common HTML breaks as new lines for layout decisions.
  const withBreaks = text.replace(/<br\s*\/?\s*>/gi, '\n');
  // Strip other HTML tags (options are usually plain text, but keep this resilient).
  const withoutTags = withBreaks.replace(/<[^>]+>/g, '');
  return withoutTags.replace(/\r\n?/g, '\n').trim();
}

function hasAnyWideChars(text: string): boolean {
  for (const ch of text || '') {
    if (isWideChar(ch)) return true;
  }
  return false;
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
  const texts = (optionTexts || []).map(normalizeOptionText);
  if (texts.length === 0) return 4;

  const anyExplicitMultiline = texts.some(t => t.includes('\n'));
  const anyWide = texts.some(hasAnyWideChars);

  // If there are explicit line breaks and we have 4 options, prefer 2 columns (two rows)
  // instead of stacking everything (better matches the UX request).
  if (texts.length === 4 && anyExplicitMultiline) return 2;
  if (anyExplicitMultiline) return 1;

  const units = texts.map(estimateTextUnits);
  const maxUnits = Math.max(...units);
  const totalUnits = units.reduce((a, b) => a + b, 0);

  // Thresholds tuned for typical card/editor widths.
  // 4-col only when everything is short.
  // Latin text often wraps earlier in 4 columns because the prefix "A." consumes width;
  // use a stricter threshold when there are no wide/CJK chars.
  const fourColMaxUnits = anyWide ? 18 : 14;
  const fourColTotalUnits = fourColMaxUnits * 4;
  if (maxUnits <= fourColMaxUnits && totalUnits <= fourColTotalUnits) return 4;

  // 2-col for medium length.
  if (maxUnits <= 42 && totalUnits <= 168) return 2;

  // Otherwise stack.
  return 1;
}
