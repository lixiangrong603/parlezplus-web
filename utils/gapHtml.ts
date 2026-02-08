export const stripGapBackgroundHighlight = (html: string): string => {
  if (!html) return html;

  try {
    if (typeof document !== 'undefined') {
      const container = document.createElement('div');
      container.innerHTML = html;

      const nodes = container.querySelectorAll<HTMLElement>('span[data-gap], .fqb-cloze-gap');
      nodes.forEach(node => {
        // Remove Tailwind background utility classes that cause yellow highlight.
        Array.from(node.classList).forEach(cls => {
          if (
            cls.startsWith('bg-amber') ||
            cls.startsWith('bg-yellow') ||
            cls.startsWith('dark:bg-amber') ||
            cls.startsWith('dark:bg-yellow')
          ) {
            node.classList.remove(cls);
          }
        });

        // Also clear inline background styles (if any).
        node.style.background = '';
        node.style.backgroundColor = '';
      });

      return container.innerHTML;
    }
  } catch {
    // ignore and fallback to regex
  }

  // Fallback: best-effort class/style cleanup without DOM APIs
  const stripBgTokens = (classes: string) =>
    classes
      .replace(/\b(?:dark:)?bg-(?:amber|yellow)-[^\s"']+\b/g, '')
      .replace(/\s+/g, ' ')
      .trim();

  let cleaned = html;
  cleaned = cleaned.replace(/class\s*=\s*"([^"]*)"/gi, (_, cls) => `class="${stripBgTokens(String(cls))}"`);
  cleaned = cleaned.replace(/class\s*=\s*'([^']*)'/gi, (_, cls) => `class='${stripBgTokens(String(cls))}'`);
  cleaned = cleaned.replace(
    /style\s*=\s*"([^"]*)"/gi,
    (_, st) => {
      const next = String(st)
        .replace(/(?:^|;)\s*background(?:-color)?\s*:[^;"]*/gi, '')
        .replace(/\s*;\s*/g, ';')
        .replace(/^;|;$/g, '')
        .trim();
      return `style="${next}"`;
    }
  );
  return cleaned;
};
