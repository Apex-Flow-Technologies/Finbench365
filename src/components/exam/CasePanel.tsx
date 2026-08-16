'use client';

import React, { useMemo } from 'react';
import { parseCasePassage } from '@/lib/exams/casePassage';

/**
 * The case scenario shown above a Section B question.
 *
 * Four questions share one passage, so it has to stay readable while the
 * candidate works through all four. The passage arrives from Word as one
 * unbroken run of text; parseCasePassage recovers the structure inside it and
 * this lays each section out as its own card, which is how a candidate reads
 * financial data — scanning for a figure, not reading a paragraph.
 *
 * Where a passage has no structure it renders as prose. Nothing is forced into
 * a layout it does not fit.
 */
export function CasePanel({
  passage,
  title,
}: {
  passage: string;
  title?: string | null;
}) {
  const parsed = useMemo(() => parseCasePassage(passage), [passage]);

  return (
    <div className="rounded-xl border border-amber-500/40 dark:border-amber-500/25 bg-amber-50/70 dark:bg-amber-500/[0.06] overflow-hidden">
      <div className="px-4 py-2.5 border-b border-amber-500/25 dark:border-amber-500/15">
        <span className="text-xs font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">
          {title || 'Case scenario'}
        </span>
      </div>

      <div className="p-4 space-y-3">
        {parsed.intro && (
          <p className="text-sm text-[#334155] dark:text-slate-300 leading-relaxed">{parsed.intro}</p>
        )}

        {/* Columns follow the content instead of always being three. A single
            block used to render as a third-width strip with two thirds of the
            row empty, which is what turned a gold-price scenario into a tall
            thin column of broken sentences. */}
        {parsed.blocks.length > 0 && (
          <div className={`grid gap-3 ${
            parsed.blocks.length === 1
              ? 'grid-cols-1'
              : parsed.blocks.length === 2
              ? 'grid-cols-1 sm:grid-cols-2'
              : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'
          }`}>
            {parsed.blocks.map((block, i) => (
              <div
                key={i}
                // A block of figures is a table and reads well narrow. A block
                // of sentences is prose and must not be squeezed into a column,
                // so it takes the full width of the row.
                className={`rounded-lg bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-white/10 p-3 ${
                  block.items.length === 0 ? 'col-span-full' : ''
                }`}
              >
                <div className="text-[11px] font-bold uppercase tracking-wide text-amber-700 dark:text-amber-400/90 mb-2 leading-snug">
                  {block.title}
                </div>

                {block.items.length > 0 && (
                  <dl className="space-y-1">
                    {block.items.map((item, j) => (
                      // A short figure sits on the same line as its label; a long
                      // one drops beneath it. Previously every value was
                      // whitespace-nowrap, so "PE = 16x, Debt/Equity = 0.5x,
                      // Current Ratio = 1.8x" ran straight out of the card and
                      // was clipped mid-word — the candidate saw "C" and the
                      // rest of the figures simply were not there to read.
                      <div key={j} className={`text-xs gap-x-3 gap-y-0.5 ${
                        item.value.length > 18
                          ? 'flex flex-col'
                          : 'flex items-baseline justify-between'
                      }`}>
                        <dt className="text-[#475569] dark:text-slate-400 leading-snug">{item.label}</dt>
                        {/* tabular-nums so figures line up down the column,
                            which is how they are compared. */}
                        <dd className="text-[#111B35] dark:text-slate-100 font-semibold tabular-nums break-words min-w-0">
                          {item.value}
                        </dd>
                      </div>
                    ))}
                  </dl>
                )}

                {block.notes.length > 0 && (
                  // Bulleted rather than stacked paragraphs: these are a list of
                  // observations, and running them together as prose is what the
                  // candidate was struggling to read in the first place.
                  <ul className="space-y-1.5 mt-1">
                    {block.notes.map((note, j) => (
                      <li key={j} className="text-xs text-[#334155] dark:text-slate-300 leading-relaxed flex gap-2">
                        <span className="text-amber-600 dark:text-amber-400/70 shrink-0 select-none">•</span>
                        <span>{note}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Tabs for the questions belonging to one case.
 *
 * A candidate answering question 3 of a case needs to move between its four
 * questions without losing the scenario above them — the general Previous/Next
 * navigation walks the whole paper and would carry them out of the case.
 */
export function CaseQuestionTabs({
  questions,
  currentIndex,
  answers,
  onSelect,
}: {
  /** The sibling questions in this case, with their index in the full paper. */
  questions: { id: string; paperIndex: number }[];
  currentIndex: number;
  answers: Record<string, number>;
  onSelect: (paperIndex: number) => void;
}) {
  if (questions.length <= 1) return null;

  return (
    <div className="flex flex-wrap gap-1.5 border-b border-white/10 pb-2">
      {questions.map((q, i) => {
        const isCurrent = q.paperIndex === currentIndex;
        const isAnswered = answers[q.id] !== undefined;
        return (
          <button
            key={q.id}
            onClick={() => onSelect(q.paperIndex)}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors border ${
              isCurrent
                ? 'bg-amber-500 text-slate-950 border-amber-500'
                : isAnswered
                ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/25'
                : 'bg-white/5 text-slate-300 border-white/10 hover:bg-white/10'
            }`}
          >
            Question {i + 1}
          </button>
        );
      })}
    </div>
  );
}
