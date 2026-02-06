export type ExamPrintMode = 'STUDENT' | 'TEACHER';

type SetState<T> = React.Dispatch<React.SetStateAction<T>>;

type RunExamPrintOptions = {
  mode: ExamPrintMode;
  setShowAnswers: SetState<boolean>;
  onCloseMenu?: () => void;
  delayMs?: number;
  title?: string;
};

/**
 * Shared print behavior used by both ExamBuilder and ExamBank preview.
 * - TEACHER: show answers
 * - STUDENT: hide answers
 * Waits a short delay to allow React to render before calling window.print().
 */
export const runExamPrint = ({ mode, setShowAnswers, onCloseMenu, delayMs = 200, title }: RunExamPrintOptions) => {
  const root = document.documentElement;
  const wasDarkMode = root.classList.contains('dark');
  const prevTitle = document.title;

  if (title) {
    try {
      // Some browsers use document.title as suggested PDF filename when printing-to-PDF
      document.title = title;
    } catch {
      // ignore
    }
  }

  // Force print to use light theme regardless of current UI theme.
  // Tailwind's `dark:` variants are controlled by the `dark` class on <html>.
  root.classList.add('print-force-light');
  if (wasDarkMode) root.classList.remove('dark');

  setShowAnswers(mode === 'TEACHER');
  onCloseMenu?.();

  const cleanupTheme = (() => {
    let cleaned = false;
    return () => {
      if (cleaned) return;
      cleaned = true;

      root.classList.remove('print-force-light');
      if (wasDarkMode) root.classList.add('dark');
      if (title) {
        try { document.title = prevTitle; } catch {}
      }
    };
  })();

  // Cleanup on print end (covers both successful print and cancel in most browsers)
  window.addEventListener('afterprint', cleanupTheme, { once: true });

  // Fallback: some browsers fire matchMedia('print') changes more reliably than afterprint.
  const mql = typeof window.matchMedia === 'function' ? window.matchMedia('print') : null;
  if (mql) {
    const onMqlChange = (e: MediaQueryListEvent) => {
      if (!e.matches) cleanupTheme();
    };

    if (typeof mql.addEventListener === 'function') {
      mql.addEventListener('change', onMqlChange);
      window.addEventListener(
        'afterprint',
        () => mql.removeEventListener('change', onMqlChange),
        { once: true }
      );
    } else if (typeof (mql as any).addListener === 'function') {
      (mql as any).addListener(onMqlChange);
      window.addEventListener(
        'afterprint',
        () => (mql as any).removeListener(onMqlChange),
        { once: true }
      );
    }
  }

  window.setTimeout(() => {
    try {
      window.print();
    } finally {
      // If the browser doesn't fire afterprint (rare), ensure we don't get stuck in light mode.
      window.setTimeout(cleanupTheme, 5_000);
    }
  }, delayMs);
};
