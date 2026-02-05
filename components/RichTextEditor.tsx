import React, { useEffect, useImperativeHandle, useRef } from 'react';
import {
  Bold, Italic, Underline,
  AlignLeft, AlignCenter, AlignRight, AlignJustify,
  List, ListOrdered, Eraser,
  Heading1, Heading2, Type, PlusSquare
} from 'lucide-react';

export interface RichTextEditorHandle {
  insertText: (text: string) => void;
  insertHTML: (html: string) => void;
}

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  minHeight?: string;
  contentClassName?: string;
  onAddCloze?: () => string | void; // Optional callback to enable Cloze Tool
}

const RichTextEditor = React.forwardRef<RichTextEditorHandle, RichTextEditorProps>(({
  value,
  onChange,
  placeholder = 'Enter content...',
  minHeight = '150px',
  contentClassName,
  onAddCloze
}, ref) => {
  const contentRef = useRef<HTMLDivElement>(null);
  const isUpdating = useRef(false);
  const savedRange = useRef<Range | null>(null);

  useEffect(() => {
    if (contentRef.current && value !== contentRef.current.innerHTML && !isUpdating.current) {
      contentRef.current.innerHTML = value;
    }
  }, [value]);

  const handleInput = () => {
    if (contentRef.current) {
      isUpdating.current = true;
      const html = contentRef.current.innerHTML;
      onChange(html);
      setTimeout(() => (isUpdating.current = false), 0);
    }
  };

  const saveSelection = () => {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0 && contentRef.current?.contains(sel.anchorNode)) {
      savedRange.current = sel.getRangeAt(0);
    }
  };

  const restoreSelection = () => {
    if (savedRange.current) {
      const sel = window.getSelection();
      if (sel) {
        sel.removeAllRanges();
        sel.addRange(savedRange.current);
      }
    }
  };

  const exec = (command: string, value: string | undefined = undefined) => {
    if (contentRef.current) {
      contentRef.current.focus();
      if ((command === 'fontName' || command === 'fontSize' || command === 'insertText' || command === 'insertHTML') && savedRange.current) {
        restoreSelection();
      }
    }

    document.execCommand(command, false, value);
    handleInput();
  };

  useImperativeHandle(ref, () => ({
    insertText: (text: string) => {
      exec('insertText', text);
    },
    insertHTML: (html: string) => {
      exec('insertHTML', html);
    }
  }));

  const ToolbarButton = ({ icon: Icon, cmd, arg, title, onClick }: { icon: any; cmd?: string; arg?: string; title?: string; onClick?: () => void }) => (
    <button
      onMouseDown={(e) => {
        e.preventDefault();
        if (onClick) {
          onClick();
        } else if (cmd) {
          exec(cmd, arg);
        }
      }}
      className="p-1.5 text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded transition-colors"
      title={title}
      type="button"
    >
      <Icon className="w-4 h-4" />
    </button>
  );

  return (
    <div className="border border-slate-300 dark:border-slate-600 rounded-lg overflow-hidden bg-white dark:bg-slate-800 focus-within:ring-2 focus-within:ring-blue-500/50 focus-within:border-blue-500 transition-all">
      <div className="flex flex-wrap items-center gap-1 p-2 border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900">
        <div className="flex gap-1 border-r border-slate-200 dark:border-slate-600 pr-2 mr-1">
          <select
            onChange={(e) => exec('fontName', e.target.value)}
            onFocus={saveSelection}
            className="text-xs border border-slate-200 dark:border-slate-600 rounded px-1 py-1 w-24 outline-none text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 cursor-pointer hover:border-blue-300"
            title="Font Family"
            defaultValue=""
          >
            <option value="">Default (Serif)</option>
            <option value="Times New Roman">Times</option>
            <option value="Georgia">Georgia</option>
            <option value="Arial">Arial</option>
            <option value="Verdana">Verdana</option>
            <option value="Courier New">Courier</option>
          </select>
          <select
            onChange={(e) => exec('fontSize', e.target.value)}
            onFocus={saveSelection}
            className="text-xs border border-slate-200 dark:border-slate-600 rounded px-1 py-1 w-14 outline-none text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 cursor-pointer hover:border-blue-300"
            title="Font Size"
            defaultValue="3"
          >
            <option value="1">1 (Small)</option>
            <option value="2">2 (Normal)</option>
            <option value="3">3 (Default)</option>
            <option value="4">4 (Medium)</option>
            <option value="5">5 (Large)</option>
          </select>
        </div>

        <div className="flex gap-0.5 border-r border-slate-200 dark:border-slate-600 pr-2 mr-1">
          <ToolbarButton icon={Bold} cmd="bold" title="Bold" />
          <ToolbarButton icon={Italic} cmd="italic" title="Italic" />
          <ToolbarButton icon={Underline} cmd="underline" title="Underline" />
        </div>

        <div className="flex gap-0.5 border-r border-slate-200 dark:border-slate-600 pr-2 mr-1">
          <ToolbarButton icon={AlignLeft} cmd="justifyLeft" title="Align Left" />
          <ToolbarButton icon={AlignCenter} cmd="justifyCenter" title="Align Center" />
          <ToolbarButton icon={AlignRight} cmd="justifyRight" title="Align Right" />
          <ToolbarButton icon={AlignJustify} cmd="justifyFull" title="Justify" />
        </div>

        <div className="flex gap-0.5 border-r border-slate-200 dark:border-slate-600 pr-2 mr-1">
          <ToolbarButton icon={List} cmd="insertUnorderedList" title="Bullet List" />
          <ToolbarButton icon={ListOrdered} cmd="insertOrderedList" title="Numbered List" />
        </div>

        <div className="flex gap-0.5 border-r border-slate-200 dark:border-slate-600 pr-2 mr-1">
          <ToolbarButton icon={Heading1} cmd="formatBlock" arg="H1" title="Heading 1" />
          <ToolbarButton icon={Heading2} cmd="formatBlock" arg="H2" title="Heading 2" />
          <ToolbarButton icon={Type} cmd="formatBlock" arg="P" title="Normal Paragraph" />
        </div>

        <div className="flex gap-0.5">
          <ToolbarButton icon={Eraser} cmd="removeFormat" title="Clear Formatting" />
        </div>

        {onAddCloze && (
          <div className="flex gap-0.5 border-l border-slate-200 dark:border-slate-600 pl-2 ml-1">
            <button
              onMouseDown={(e) => {
                e.preventDefault();
                const text = onAddCloze();
                if (text) {
                  exec('insertHTML', text);
                }
              }}
              className="flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-600 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-300 dark:hover:bg-blue-900/50 rounded text-xs font-bold transition-colors"
              title="Insert Cloze Gap"
              type="button"
            >
              <PlusSquare className="w-3.5 h-3.5" /> Gap
            </button>
          </div>
        )}
      </div>

      <div
        ref={contentRef}
        contentEditable
        onInput={handleInput}
        onBlur={saveSelection}
        className={`p-4 outline-none prose max-w-none text-[16px] text-slate-900 dark:text-slate-200 leading-relaxed overflow-y-auto rich-editor-content font-serif ${contentClassName || ''}`}
        style={{ minHeight }}
        data-placeholder={placeholder}
        onKeyDown={(e) => {
          if (e.key === 'Tab') {
            e.preventDefault();
            exec('insertHTML', '&nbsp;&nbsp;&nbsp;&nbsp;');
          }
        }}
      />
      <style>{`
        [contenteditable]:empty:before {
          content: attr(data-placeholder);
          color: #94a3b8;
          cursor: text;
        }
        .rich-editor-content h1 { font-size: 1.75em; font-weight: bold; margin-top: 0.5em; margin-bottom: 0.25em; line-height: 1.2; color: inherit; display: block; }
        .rich-editor-content h2 { font-size: 1.4em; font-weight: bold; margin-top: 0.5em; margin-bottom: 0.25em; line-height: 1.3; color: inherit; display: block; }
        .rich-editor-content h3, .rich-editor-content h4 { font-size: 1.2em; font-weight: bold; margin-top: 0.5em; margin-bottom: 0.5em; color: inherit; display: block; }
        .rich-editor-content p { margin-top: 0.5em; margin-bottom: 0.5em; display: block; }
        .rich-editor-content ul { list-style-type: disc; padding-left: 1.5em; display: block; }
        .rich-editor-content ol { list-style-type: decimal; padding-left: 1.5em; display: block; }
        .rich-editor-content div { display: block; }
      `}</style>
    </div>
  );
});

RichTextEditor.displayName = 'RichTextEditor';

export default RichTextEditor;
