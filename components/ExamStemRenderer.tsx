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
    const processedStem = content.stem
      .replace(/_{3,}/g, '_______________')
      .replace(/\.{3,}/g, '_______________');

    return (
      <div className="mb-2">
        <p className="text-base text-slate-800 dark:text-slate-200 leading-relaxed whitespace-pre-wrap">
          {processedStem}
        </p>
        
        {/* Show answer for fill-in-the-blank when answers are visible */}
        {showAnswers && !content.options && content.correctAnswer && (
          <div className="mt-2 p-3 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-900/30 rounded text-indigo-900 dark:text-indigo-200 font-serif text-sm">
            <span className="font-bold">Réponse :</span> {content.correctAnswer}
            {content.explanation && (
              <div className="mt-1 pt-1 border-t border-indigo-200 dark:border-indigo-900/50 text-xs text-slate-600 dark:text-slate-400 italic">
                Exp: {content.explanation}
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  return null;
};

export default ExamStemRenderer;
