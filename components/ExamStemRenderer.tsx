import React from 'react';
import { QuestionType } from '../types';

interface QuestionContent {
  stem?: string;
  options?: string[];
  correctAnswer?: string;
  explanation?: string;
  readingPassage?: string;
  subQuestions?: Array<{
    stem: string;
    options?: string[];
    correctAnswer?: string;
  }>;
}

interface ExamStemRendererProps {
  content: QuestionContent;
  type?: QuestionType;
  showAnswers?: boolean;
}

const ExamStemRenderer: React.FC<ExamStemRendererProps> = ({ content, type, showAnswers = false }) => {
  const escapeHtml = (input: string) =>
    input
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');

  const splitAnswers = (raw: string) =>
    raw
      .split(/[;,，；]/)
      .map(a => a.trim())
      .filter(Boolean);

  const injectAnswersIntoHtmlGaps = (stemHtml: string, answers: string[]) => {
    // Prefer DOM parsing when available (browser)
    if (typeof document !== 'undefined') {
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = stemHtml;

      const gapNodes: Element[] = Array.from(
        tempDiv.querySelectorAll('[data-gap], .fqb-cloze-gap')
      );

      if (gapNodes.length > 0) {
        let answerIndex = 0;
        gapNodes.forEach(node => {
          const answer = answers[answerIndex];
          answerIndex++;
          const replacementHtml = answer
            ? `<span class="text-red-600 dark:text-red-400 font-bold underline decoration-red-600 dark:decoration-red-400">${escapeHtml(answer)}</span>`
            : '_______________';
          node.replaceWith(tempDiv.ownerDocument.createRange().createContextualFragment(replacementHtml));
        });
        return tempDiv.innerHTML;
      }

      return stemHtml;
    }

    // Fallback: best-effort regex replacement
    let idx = 0;
    return stemHtml.replace(
      /<span[^>]*(?:data-gap\s*=\s*"\d+"|class\s*=\s*"[^"]*fqb-cloze-gap[^"]*")[^>]*>.*?<\/span>/gi,
      () => {
        const answer = answers[idx];
        idx++;
        if (!answer) return '_______________';
        return `<span class="text-red-600 dark:text-red-400 font-bold underline decoration-red-600 dark:decoration-red-400">${escapeHtml(answer)}</span>`;
      }
    );
  };

  // Reading Comprehension - Only passage (sub-questions handled separately)
  if (type === 'reading-comprehension' && content.readingPassage) {
    return <div className="whitespace-pre-wrap text-justify leading-relaxed">{content.readingPassage}</div>;
  }

  // Cloze Test - Show passage with blanks
  if (type === 'cloze-test' && content.readingPassage) {
    return <div className="whitespace-pre-wrap text-justify leading-relaxed">{content.readingPassage}</div>;
  }

  // Multiple Choice or Fill-in-the-blank - Show stem
  if (content.stem) {
    const isSingleFillInBlank =
      type === 'fill-in-the-blank' && (!content.options || content.options.length === 0);

    const isBlankInStemQuestion =
      type === 'fill-in-the-blank' || type === 'multiple-choice' || !type;

    const BLANK_TOKEN = '__PP_BLANK__';

    // 1) First, handle HTML-based gap placeholders (from the rich editor)
    let processedStem = content.stem;
    if (showAnswers && isBlankInStemQuestion && content.correctAnswer) {
      const answers = splitAnswers(content.correctAnswer);
      processedStem = injectAnswersIntoHtmlGaps(processedStem, answers);
    }

    // 2) Then, handle plain-text style blanks (underscores / dots / {{n}})
    processedStem = processedStem.replace(/\{\{\d+\}\}|_{3,}|\.{3,}/g, BLANK_TOKEN);

    // For blank-in-stem questions with answers visible, replace blank tokens with red answers
    if (showAnswers && isBlankInStemQuestion && content.correctAnswer) {
      const answers = splitAnswers(content.correctAnswer);
      let answerIndex = 0;

      processedStem = processedStem.replace(new RegExp(BLANK_TOKEN, 'g'), () => {
        const answer = answers[answerIndex];
        answerIndex++;
        if (!answer) return '_______________';
        return `<span class="text-red-600 dark:text-red-400 font-bold underline decoration-red-600 dark:decoration-red-400">${escapeHtml(answer)}</span>`;
      });
    }

    // Replace any remaining blank tokens with underscores
    processedStem = processedStem.replace(new RegExp(BLANK_TOKEN, 'g'), '_______________');

    return (
      <div className="mb-2">
        <p 
          className="text-base text-slate-800 dark:text-slate-200 leading-relaxed whitespace-pre-wrap"
          dangerouslySetInnerHTML={{ __html: processedStem }}
        />
        
        {/* Show explanation when answers are visible */}
        {showAnswers && isSingleFillInBlank && content.explanation && (
          <div className="mt-2 p-3 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-900/30 rounded text-indigo-900 dark:text-indigo-200 font-serif text-sm">
            <span className="font-bold">Explication :</span>
            <div className="mt-1 text-xs text-slate-600 dark:text-slate-400 italic">
              {content.explanation}
            </div>
          </div>
        )}
      </div>
    );
  }

  return null;
};

export default ExamStemRenderer;
