import { Document, Packer, Paragraph, TextRun, AlignmentType, HeadingLevel, Table, TableRow, TableCell, WidthType, BorderStyle, TabStopType } from "docx";
import saveAs from "file-saver";
import { ExamPaper, Question, QuestionOption } from "../types";

// Constant font settings to match Serif preview
const MAIN_FONT = "Times New Roman";
const MAIN_SIZE = 22; // 11pt (Word measures in half-points)

// Helper to convert HTML string to Docx Paragraphs
const htmlToDocx = (
  html: string, 
  options: { 
    defaultBold?: boolean, 
    prefixRuns?: TextRun[], 
    paragraphSpacing?: { after?: number, before?: number, line?: number, lineRule?: "auto" | "atLeast" | "exactly" | "exact" },
    justify?: boolean
  } = {}
): Paragraph[] => {
  const { defaultBold = false, prefixRuns, paragraphSpacing, justify = false } = options;

  // Create a temporary DOM element to parse HTML
  const tempDiv = document.createElement("div");
  tempDiv.innerHTML = html;

  // --- CLOZE CLEANUP FOR WORD ---
  // If we find .fqb-cloze-gap spans (from the editor), replace them with " (n) ______ "
  const gaps = tempDiv.querySelectorAll('.fqb-cloze-gap');
  if (gaps.length > 0) {
      gaps.forEach((gap, index) => {
          const num = index + 1;
          const textNode = document.createTextNode(` (${num}) ______________ `);
          gap.replaceWith(textNode);
      });
  }

  const paragraphs: Paragraph[] = [];
  let prefixConsumed = false;

  const attachPrefix = (runs: TextRun[]) => {
      if (!prefixConsumed && prefixRuns && prefixRuns.length > 0) {
          runs.unshift(...prefixRuns);
          prefixConsumed = true;
      }
      return runs;
  };

  // Helper to parse size string to half-points
  const parseSize = (val: string | null): number | undefined => {
    if (!val) return undefined;
    if (['1','2','3','4','5','6','7'].includes(val)) {
        const map: Record<string, number> = { '1': 16, '2': 20, '3': MAIN_SIZE, '4': 28, '5': 36, '6': 48, '7': 72 };
        return map[val];
    }
    if (val.endsWith('pt')) return parseFloat(val) * 2;
    if (val.endsWith('px')) return parseFloat(val) * 1.5; 
    if (val === 'small') return 20;
    if (val === 'medium') return 24;
    if (val === 'large') return 32;
    if (val === 'x-large') return 48;
    return undefined;
  };

  // Helper to parse color
  const parseColor = (val: string | null): string | undefined => {
      if (!val) return undefined;
      if (val.startsWith('#')) return val.replace('#', '');
      return val.replace('#', '');
  };

  // Recursive text run generator
  const getRuns = (node: Node, currentStyle: { bold: boolean, italics: boolean, underline: boolean, size?: number, font?: string, color?: string }): TextRun[] => {
      const runs: TextRun[] = [];
      
      if (node.nodeType === Node.TEXT_NODE) {
          const text = node.textContent;
          if (text) {
              runs.push(new TextRun({
                  text: text,
                  bold: currentStyle.bold,
                  italics: currentStyle.italics,
                  underline: currentStyle.underline ? { type: BorderStyle.SINGLE } : undefined,
                  size: currentStyle.size || MAIN_SIZE,
                  font: currentStyle.font || MAIN_FONT,
                  color: currentStyle.color || "000000"
              }));
          }
      } else if (node.nodeType === Node.ELEMENT_NODE) {
          const el = node as HTMLElement;
          const newStyle = { ...currentStyle };
          
          // Check tags
          if (['B', 'STRONG', 'H1', 'H2', 'H3', 'H4'].includes(el.tagName)) newStyle.bold = true;
          if (['I', 'EM'].includes(el.tagName)) newStyle.italics = true;
          if (['U'].includes(el.tagName)) newStyle.underline = true;
          
          // Check attributes
          if (el.getAttribute('face')) newStyle.font = el.getAttribute('face')!;
          if (el.getAttribute('color')) newStyle.color = parseColor(el.getAttribute('color'));
          if (el.getAttribute('size')) {
             const s = parseSize(el.getAttribute('size'));
             if (s) newStyle.size = s;
          }

          // Check inline styles
          if (el.style.fontWeight === 'bold' || parseInt(el.style.fontWeight) >= 700) newStyle.bold = true;
          if (el.style.fontStyle === 'italic') newStyle.italics = true;
          if (el.style.textDecoration === 'underline') newStyle.underline = true;
          if (el.style.fontFamily) newStyle.font = el.style.fontFamily;
          if (el.style.color) newStyle.color = parseColor(el.style.color);
          if (el.style.fontSize) {
             const s = parseSize(el.style.fontSize);
             if (s) newStyle.size = s;
          }

          // Special handling for BR
          if (el.tagName === 'BR') {
              runs.push(new TextRun({ break: 1 }));
          }

          el.childNodes.forEach(child => {
              runs.push(...getRuns(child, newStyle));
          });
      }
      return runs;
  };

  // Block tags that trigger a new paragraph
  const blockTags = ['P', 'DIV', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'LI', 'UL', 'OL', 'BLOCKQUOTE'];
  
  const processBlock = (node: Node): Paragraph[] => {
      const el = node as HTMLElement;
      
      let alignment: (typeof AlignmentType)[keyof typeof AlignmentType] = justify ? AlignmentType.BOTH : AlignmentType.LEFT;
      let headingLevel: (typeof HeadingLevel)[keyof typeof HeadingLevel] | undefined = undefined;

      // Determine alignment
      if (el.style.textAlign === 'center') alignment = AlignmentType.CENTER;
      else if (el.style.textAlign === 'right') alignment = AlignmentType.RIGHT;
      else if (el.style.textAlign === 'justify') alignment = AlignmentType.BOTH;
      if (el.getAttribute('align') === 'center') alignment = AlignmentType.CENTER;

      // Determine Heading
      if (el.tagName === 'H1') { headingLevel = HeadingLevel.HEADING_1; }
      else if (el.tagName === 'H2') { headingLevel = HeadingLevel.HEADING_2; }
      else if (el.tagName === 'H3') { headingLevel = HeadingLevel.HEADING_3; }
      else if (el.tagName === 'H4') { headingLevel = HeadingLevel.HEADING_4; }

      // Generate runs from children
      const runs: TextRun[] = [];
      const baseStyle = { 
          bold: defaultBold || ['H1','H2','H3','H4'].includes(el.tagName), 
          italics: false, 
          underline: false,
          size: undefined as number | undefined,
          font: undefined as string | undefined,
          color: undefined as string | undefined
      };
      
      // Inherit block style
      if (el.style.fontSize) baseStyle.size = parseSize(el.style.fontSize);
      if (el.style.fontFamily) baseStyle.font = el.style.fontFamily;
      if (el.style.color) baseStyle.color = parseColor(el.style.color);

      el.childNodes.forEach(child => {
          runs.push(...getRuns(child, baseStyle));
      });
      
      // If we have a prefix waiting, prepend it now
      attachPrefix(runs);

      if (runs.length === 0) return []; 

      return [new Paragraph({
          children: runs,
          alignment: alignment,
          heading: headingLevel,
          spacing: paragraphSpacing || { after: 100, line: 360, lineRule: "auto" }
      })];
  };

  let currentInlineRuns: TextRun[] = [];
  
  // Iterate over root nodes
  tempDiv.childNodes.forEach(node => {
      const el = node as HTMLElement;
      const isBlock = node.nodeType === Node.ELEMENT_NODE && blockTags.includes(el.tagName);
      
      if (isBlock) {
          // Flush existing inline runs into a paragraph
          if (currentInlineRuns.length > 0) {
              attachPrefix(currentInlineRuns);
              paragraphs.push(new Paragraph({ 
                  children: currentInlineRuns, 
                  spacing: paragraphSpacing || { after: 100, line: 360, lineRule: "auto" },
                  alignment: justify ? AlignmentType.BOTH : AlignmentType.LEFT
              }));
              currentInlineRuns = [];
          }
          // Process block
          paragraphs.push(...processBlock(node));
      } else {
          // Accumulate inline runs
          currentInlineRuns.push(...getRuns(node, { bold: defaultBold, italics: false, underline: false, color: undefined }));
      }
  });
  
  // Flush remaining inline runs
  if (currentInlineRuns.length > 0) {
      attachPrefix(currentInlineRuns);
      paragraphs.push(new Paragraph({ 
          children: currentInlineRuns, 
          spacing: paragraphSpacing || { after: 100, line: 360, lineRule: "auto" },
          alignment: justify ? AlignmentType.BOTH : AlignmentType.LEFT
      }));
  }
  
  // Fallback if empty but has prefix
  if (paragraphs.length === 0 && !prefixConsumed && prefixRuns && prefixRuns.length > 0) {
      paragraphs.push(new Paragraph({ children: prefixRuns, spacing: paragraphSpacing }));
  }
  
  // Fallback if empty and no prefix
  if (paragraphs.length === 0 && tempDiv.textContent?.trim() && !prefixConsumed) {
      paragraphs.push(new Paragraph({ 
          children: [new TextRun({ text: tempDiv.textContent.trim(), bold: defaultBold, font: MAIN_FONT, size: MAIN_SIZE })], 
          spacing: paragraphSpacing 
      }));
  }

  return paragraphs;
};

// Helper to create Options Layout using Tabs (No Table)
const createOptionsParagraphs = (options: string[]): Paragraph[] => {
    if (!options || options.length === 0) return [];

    // Determine layout based on length
    const maxLen = Math.max(...options.map(o => o.length));
    let columns = 1;
    if (maxLen < 15) columns = 4;
    else if (maxLen < 35) columns = 2;

    const paragraphs: Paragraph[] = [];
    const rowsCount = Math.ceil(options.length / columns);

    // Calculate Tab Stops - A4 safe content width approx 9000 twips
    const CONTENT_WIDTH = 9000;
    const tabStops: { type: (typeof TabStopType)[keyof typeof TabStopType], position: number }[] = [];
    
    if (columns > 1) {
        const colWidth = CONTENT_WIDTH / columns;
        for (let i = 1; i < columns; i++) {
            tabStops.push({
                type: TabStopType.LEFT,
                position: Math.floor(colWidth * i),
            });
        }
    }

    for (let r = 0; r < rowsCount; r++) {
        const rowChildren: TextRun[] = [];
        for (let c = 0; c < columns; c++) {
            const idx = r * columns + c;
            if (idx < options.length) {
                const letter = String.fromCharCode(65 + idx); // A, B, C...
                const text = options[idx];
                
                // Add Tab for 2nd+ column
                if (c > 0) {
                    rowChildren.push(new TextRun({ text: "\t" }));
                }

                rowChildren.push(new TextRun({ text: `${letter}. `, bold: true, font: MAIN_FONT, size: MAIN_SIZE }));
                rowChildren.push(new TextRun({ text: text, font: MAIN_FONT, size: MAIN_SIZE }));
            }
        }
        paragraphs.push(new Paragraph({
            children: rowChildren,
            tabStops: tabStops,
            spacing: { after: 50 } // Tight spacing for options
        }));
    }

    return paragraphs;
};

// Helper to get the correct answer letter for MCQ
const getCorrectAnswerLetter = (q: Question): string => {
    if (!q.options || !q.correctOptionId) return '';
    const idx = q.options.findIndex(opt => opt.id === q.correctOptionId);
    if (idx === -1) return q.correctOptionId;
    return String.fromCharCode(65 + idx); // A, B, C, D...
};

// Helper to get stem content - uses q.text or q.readingPassage
const getStemContent = (q: Question): string => {
    return q.text || q.readingPassage || '';
};

// Helper to get options as string array
const getOptionsAsStrings = (options?: QuestionOption[]): string[] => {
    if (!options) return [];
    return options.map(o => o.text);
};

export const generateWordDocument = async (exam: ExamPaper, allQuestions: Question[], version: 'STUDENT' | 'TEACHER' = 'STUDENT') => {
  const children: (Paragraph | Table)[] = [];

  // 1. Title
  children.push(
    new Paragraph({
      children: [new TextRun({ text: exam.title + (version === 'TEACHER' ? " (教师版)" : ""), font: MAIN_FONT, size: 32, bold: true })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 400 },
    })
  );

  // 2. Header Info (Invisible Table)
  const createHeaderCell = (label: string) => {
    return new TableCell({
      children: [
        new Paragraph({ children: [new TextRun({ text: label, font: MAIN_FONT, size: MAIN_SIZE })], spacing: { after: 300 } }), 
        new Paragraph({ 
            border: { bottom: { style: BorderStyle.SINGLE, size: 1, color: "000000" } },
            text: "", 
        })
      ],
      width: { size: 33, type: WidthType.PERCENTAGE },
      borders: { top: { style: BorderStyle.NIL }, bottom: { style: BorderStyle.NIL }, left: { style: BorderStyle.NIL }, right: { style: BorderStyle.NIL } },
    });
  };

  const headerTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        children: [
          createHeaderCell("姓名:"),
          createHeaderCell("班级:"),
          createHeaderCell(`得分:           / ${exam.totalScore}`),
        ],
      }),
    ],
  });

  children.push(headerTable);
  children.push(new Paragraph({ text: "", spacing: { after: 400 } }));

  // Helper to append answer block for teacher version
  const appendTeacherBlock = (correctAnswer: string, explanation?: string) => {
      children.push(
          new Paragraph({
              children: [
                  new TextRun({ text: "答案：", bold: true, color: "DC2626", font: MAIN_FONT, size: MAIN_SIZE }), 
                  new TextRun({ text: correctAnswer, bold: true, color: "DC2626", font: MAIN_FONT, size: MAIN_SIZE }),
              ],
              spacing: { before: 50, after: 50 },
          })
      );
      children.push(
          new Paragraph({
              children: [
                  new TextRun({ text: "解析：", bold: true, color: "666666", font: MAIN_FONT, size: MAIN_SIZE }),
                  new TextRun({ text: explanation || "暂无解析", color: "666666", font: MAIN_FONT, size: MAIN_SIZE }),
              ],
              spacing: { after: 200 },
              border: { bottom: { style: BorderStyle.DOTTED, size: 1, color: "CCCCCC" } }
          })
      );
  };

  // 3. Sections
  exam.sections.forEach((section) => {
    children.push(
      new Paragraph({
        children: [new TextRun({ text: section.title, bold: true, size: 28, font: MAIN_FONT })],
        spacing: { before: 400, after: 100 },
      })
    );

    children.push(
      new Paragraph({
        children: [new TextRun({ text: section.instructions, italics: true, font: MAIN_FONT, size: MAIN_SIZE })],
        spacing: { after: 300 },
      })
    );

    // Items
    let questionIndex = 0;
    section.items.forEach((item) => {
      // Handle consigne items
      if (item.type === 'consigne') {
        if (item.consigneText) {
          children.push(
            new Paragraph({
              children: [new TextRun({ text: item.consigneText, italics: true, color: "B45309", font: MAIN_FONT, size: MAIN_SIZE })],
              spacing: { before: 100, after: 100 },
              indent: { left: 200 }
            })
          );
        }
        return;
      }

      const q = allQuestions.find((qu) => qu.id === item.questionId);
      if (!q) return;

      questionIndex++;
      const showNumber = section.items.filter(i => i.type !== 'consigne').length > 1;
      const stemContent = getStemContent(q);

      // --- CLOZE TEST & COMPOUND FILL HANDLING ---
      if (q.type === 'cloze-test' || q.type === 'compound-fill') {
          const prefixRuns = showNumber 
            ? [new TextRun({ text: `${questionIndex}. `, bold: true, font: MAIN_FONT, size: MAIN_SIZE })] 
            : undefined;
          
          let displayStem = q.readingPassage || q.text || '';

          if (version === 'TEACHER' && q.subQuestions) {
              // Teacher Version: Replace {{n}} with Red Underlined Answers
              q.subQuestions.forEach((sq, idx) => {
                 const pattern = new RegExp(`{{\\s*${idx+1}\\s*}}`, 'g');
                 const answer = sq.correctOptionId ? getCorrectAnswerLetter(sq) : '';
                 displayStem = displayStem.replace(pattern, `<span style="color:DC2626; text-decoration:underline; font-weight:bold;">${answer}</span>`);
              });
          } else {
              // Student Version: Replace {{n}} with (n) ______
              displayStem = displayStem.replace(/{{\s*(\d+)\s*}}/g, ' ($1) ______________ ');
          }

          const stemParagraphs = htmlToDocx(displayStem, { 
              prefixRuns, 
              paragraphSpacing: { after: 200, line: 360, lineRule: "auto" },
              justify: true 
          });
          children.push(...stemParagraphs);

          // Sub-questions with options (for cloze-test)
          if (q.subQuestions && q.subQuestions.some(sq => sq.options && sq.options.length > 0)) {
              q.subQuestions.forEach((sq, idx) => {
                  if (!sq.options || sq.options.length === 0) return;
                  
                  // Sub-question number
                  children.push(
                      new Paragraph({
                          children: [
                              new TextRun({ text: `${idx + 1}) `, bold: true, font: MAIN_FONT, size: MAIN_SIZE }),
                          ],
                          spacing: { before: 50, after: 50 },
                      })
                  );

                  // Options layout (same as reading comprehension)
                  if (sq.options && sq.options.length > 0) {
                      children.push(...createOptionsParagraphs(getOptionsAsStrings(sq.options)));
                  }

                  if (version === 'TEACHER') {
                      appendTeacherBlock(getCorrectAnswerLetter(sq), sq.explanation);
                  }
              });
          }

          // Teacher Explanations (grouped at bottom)
          if (version === 'TEACHER' && q.subQuestions) {
             const explRuns: TextRun[] = [];
             
             q.subQuestions.forEach((sq, idx) => {
                 // For compound-fill, show answer + explanation; for cloze-test, just explanation
                 const answerText = q.type === 'compound-fill' && sq.options && sq.options[0]
                   ? `${sq.options[0].text}${sq.explanation ? ' - ' : ''}`
                   : '';
                 const fullText = `(${idx+1}) ${answerText}${sq.explanation || ''}`;
                 if (sq.explanation || answerText) {
                    explRuns.push(new TextRun({ text: fullText, break: idx > 0 ? 1 : 0, color: "666666", font: MAIN_FONT, size: MAIN_SIZE }));
                 }
             });

             if (explRuns.length > 0) {
                 children.push(new Paragraph({
                     children: [
                         new TextRun({ text: "解析：", bold: true, color: "666666", font: MAIN_FONT, size: MAIN_SIZE }),
                         ...explRuns
                     ],
                     spacing: { after: 200 },
                     border: { bottom: { style: BorderStyle.DOTTED, size: 1, color: "CCCCCC" } }
                 }));
             }
          }
          return;
      }

      // --- READING COMPREHENSION HANDLING ---
      if (q.type === 'reading-comprehension' && q.subQuestions) {
          const headerRuns: TextRun[] = [];
          if (showNumber) {
             headerRuns.push(new TextRun({ text: `${questionIndex}. `, bold: true, size: 24, font: MAIN_FONT }));
          }
          headerRuns.push(new TextRun({ text: "(阅读理解) ", italics: true, font: MAIN_FONT, size: MAIN_SIZE }));

          children.push(
            new Paragraph({
              children: headerRuns,
              spacing: { after: 100 },
            })
          );
          
          // Passage Content (Justified)
          const passageContent = q.readingPassage || q.text || '';
          const stemParagraphs = htmlToDocx(passageContent, { justify: true });
          stemParagraphs.forEach(p => children.push(p));

          // Sub-questions
          q.subQuestions.forEach((sq, sqIdx) => {
              children.push(
                  new Paragraph({
                      children: [
                          new TextRun({ text: `${sqIdx + 1}) `, bold: true, font: MAIN_FONT, size: MAIN_SIZE }),
                          new TextRun({ text: sq.text || '', font: MAIN_FONT, size: MAIN_SIZE }),
                      ],
                      spacing: { before: 50, after: 50 },
                  })
              );

              // Options layout
              if (sq.options && sq.options.length > 0) {
                  children.push(...createOptionsParagraphs(getOptionsAsStrings(sq.options)));
              }

              if (version === 'TEACHER') {
                  appendTeacherBlock(getCorrectAnswerLetter(sq), sq.explanation);
              }
          });
      } else {
        // --- STANDARD QUESTION HANDLING (MCQ, Fill-in-the-blank) ---
        
        const prefixRuns = showNumber 
            ? [new TextRun({ text: `${questionIndex}. `, bold: true, font: MAIN_FONT, size: MAIN_SIZE })]
            : undefined;

        // Process stem, replacing blank patterns
        let processedStem = stemContent
            .replace(/_{3,}/g, '_______________')
            .replace(/\.{3,}/g, '_______________');

        const stemParagraphs = htmlToDocx(processedStem, { 
            defaultBold: false, 
            prefixRuns, 
            justify: true,
            paragraphSpacing: { after: 100 } 
        });
        children.push(...stemParagraphs);

        // Options layout for MCQ
        if (q.type === 'multiple-choice' && q.options) {
            children.push(...createOptionsParagraphs(getOptionsAsStrings(q.options)));
        } 
        
        if (version === 'TEACHER') {
            const correctAnswer = q.type === 'multiple-choice' 
                ? getCorrectAnswerLetter(q) 
                : (q.correctOptionId || '');
            appendTeacherBlock(correctAnswer, q.explanation);
        }
      }
    });
  });

  const doc = new Document({
    sections: [
      {
        properties: {},
        children: children,
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  const fileName = `${exam.title.replace(/\s+/g, "_")}_${version === 'TEACHER' ? '教师版' : '学生版'}.docx`;
  saveAs(blob, fileName);
};
