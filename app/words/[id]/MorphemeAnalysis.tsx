'use client';
import { useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { MorphemeType, generateMorphemeCandidates, type MorphemePart } from '@/lib/grammar/common';
import {ScriptMode} from "@/lib/script-mode";

interface MorphemeAnalysisProps {
  word: string;
  roots: { id: number; value: string; type: number }[] | null | undefined;
  base: string | null | undefined;
  currentScript: ScriptMode;
}

function isNumeric(value: string): boolean {
  return /^\d+$/.test(value);
}

function extractMorphemes(word: string, base: string | null | undefined, roots: { id: number; value: string; type: number }[] | null | undefined): MorphemePart[] | null {
  if (!roots || roots.length === 0) return null;

  const wordLower = word.toLowerCase();

  interface Match {
    start: number;
    end: number;
    text: string;
  }

  const allMatches: Match[] = [];

  for (const root of roots) {
    if (!root.value || isNumeric(root.value)) continue;
    const candidates = generateMorphemeCandidates(root.value, root.type);

    for (const candidate of candidates) {
      if (candidate.length < 2 && candidate.length < wordLower.length) continue;
      let pos = 0;
      while ((pos = wordLower.indexOf(candidate, pos)) !== -1) {
        allMatches.push({
          start: pos,
          end: pos + candidate.length,
          text: word.slice(pos, pos + candidate.length),
        });
        pos++;
      }
    }
  }

  if (allMatches.length === 0) return null;

  allMatches.sort((a, b) =>
    a.start - b.start || (b.end - b.start) - (a.end - a.start)
  );

  const resolved: Match[] = [];
  let lastEnd = 0;
  for (const m of allMatches) {
    if (m.start >= lastEnd) {
      resolved.push(m);
      lastEnd = m.end;
    }
  }

  const parts: MorphemePart[] = [];
  let cursor = 0;

  for (const m of resolved) {
    if (m.start > cursor) {
      parts.push({
        type: cursor === 0 ? MorphemeType.PREFIX : MorphemeType.UNKNOWN,
        text: word.slice(cursor, m.start),
      });
    }
    parts.push({ type: MorphemeType.ROOT, text: m.text });
    cursor = m.end;
  }

  if (base) {
    const baseLower = base.toLowerCase();
    const baseIdx = wordLower.indexOf(baseLower);

    if (baseIdx !== -1) {
      const stemEnd = baseIdx + base.length;

      if (cursor < stemEnd) {
        parts.push({
          type: MorphemeType.SUFFIX,
          text: word.slice(cursor, stemEnd),
        });
        cursor = stemEnd;
      }

      if (cursor < word.length) {
        parts.push({
          type: MorphemeType.ENDING,
          text: word.slice(cursor),
        });
      }
    }
  } else {
    if (cursor < word.length) {
      parts.push({
        type: MorphemeType.SUFFIX,
        text: word.slice(cursor),
      });
    }
  }

  if (!parts.some(p => p.type === MorphemeType.ROOT)) return null;
  return parts;
}

const COLOR: Record<MorphemeType, string> = {
  [MorphemeType.ROOT]: '#2563eb',
  [MorphemeType.PREFIX]: '#d97706',
  [MorphemeType.SUFFIX]: '#16a34a',
  [MorphemeType.UNKNOWN]: '#cbd5e1',
  [MorphemeType.ENDING]: '#94a3b8',
};

function measureWidths(parts: { text: string }[]): number[] {
  if (typeof document === 'undefined') {
    return parts.map(p => p.text.length * 12);
  }

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return parts.map(p => p.text.length * 12);

  ctx.font = '500 20px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace';

  return parts.map(p => {
    const width = ctx.measureText(p.text).width;
    return width > 0 ? width : p.text.length * 12;
  });
}

export default function MorphemeAnalysis({ word, roots, base }: MorphemeAnalysisProps) {
  const t = useTranslations("word");
  const raw = useMemo(() => extractMorphemes(word, base, roots), [word, roots]);

  const morphemes: MorphemePart[] | null = raw;

  const widths = useMemo(() => morphemes ? measureWidths(morphemes) : [], [morphemes]);
  const gap = 8;
  const totalW = widths.reduce((s, w) => s + w, 0) + (morphemes ? (morphemes.length - 1) * gap : 0);
  const svgWidth = Math.max(280, totalW + 40);
  const MARK_Y = 22;
  const ARC_TOP = 12;
  const TEXT_Y = 40;
  const STEM_Y = 48;

  const hasVisible = morphemes !== null && morphemes.some(p => p.type !== MorphemeType.UNKNOWN);

  if (!hasVisible) {
    return (
      <section className="mb-6">
        <h2 className="text-lg font-bold text-slate-800 border-l-4 border-blue-600 pl-3 mb-3">{t('morpheme.heading')}</h2>
        <div className="bg-slate-50 border border-slate-100 rounded-xl p-6 text-center text-slate-400 italic text-sm">
          <span className="text-xl font-mono tracking-wide text-slate-300">{word}</span>
          <p className="mt-2">{t('morpheme.unavailable')}</p>
        </div>
      </section>
    );
  }

  let x = 20;
  const nodes: React.ReactNode[] = [];
  const labelNodes: React.ReactNode[] = [];

  const LABEL: Record<MorphemeType, string> = {
    [MorphemeType.ROOT]: t('morpheme.legend.root'),
    [MorphemeType.PREFIX]: t('morpheme.legend.prefix'),
    [MorphemeType.SUFFIX]: t('morpheme.legend.suffix'),
    [MorphemeType.UNKNOWN]: t('morpheme.legend.connective'),
    [MorphemeType.ENDING]: t('morpheme.legend.ending'),
  };

  for (let i = 0; i < morphemes!.length; i++) {
    const part = morphemes![i];
    const type = part.type as MorphemeType;
    const w = widths[i];
    const cx = x + w / 2;
    const color = COLOR[type];

    if (type === MorphemeType.PREFIX) {
      nodes.push(
        <g key={`pre-${i}`}>
          <line x1={x} y1={MARK_Y} x2={x + w} y2={MARK_Y} stroke={color} strokeWidth={2} />
          <line x1={x + w} y1={MARK_Y} x2={x + w} y2={MARK_Y + 8} stroke={color} strokeWidth={2} />
        </g>,
      );
    } else if (type === MorphemeType.ROOT) {
      nodes.push(
        <path key={`root-${i}`} d={`M ${x} ${MARK_Y} Q ${cx} ${ARC_TOP} ${x + w} ${MARK_Y}`} fill="none" stroke={color} strokeWidth={2} />,
      );
    } else if (type === MorphemeType.SUFFIX) {
      nodes.push(
        <g key={`suf-${i}`}>
          <polyline points={`${x},${MARK_Y} ${cx},${ARC_TOP} ${x + w},${MARK_Y}`} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" />
        </g>,
      );
    }

    nodes.push(
      <text key={`txt-${i}`} x={x} y={TEXT_Y} fill={color} fontSize={20} fontFamily="ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace" fontWeight="500">
        {part.text}
      </text>,
    );

    labelNodes.push(
      <span key={i} className="flex items-center gap-1">
        <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
        {LABEL[type]}: {part.text}
      </span>,
    );

    x += w + gap;
  }

  const svgHeight = base ? 62 : 52;

  return (
    <section className="mb-6">
      <h2 className="text-lg font-bold text-slate-800 border-l-4 border-blue-600 pl-3 mb-3">{t('morpheme.heading')}</h2>
      <div className="bg-slate-50 border border-slate-100 rounded-xl p-6">
        <div className="flex flex-col items-center gap-3">
          <svg width={svgWidth} height={svgHeight} className="block">
            {nodes}
            {base && (() => {
              const baseIdx = word.toLowerCase().indexOf(base.toLowerCase());
              if (baseIdx === -1) return null;
              const baseEnd = baseIdx + base.length;
              let sx = 20;
              let charIdx = 0;
              let stemStartX = sx;
              let stemEndX = sx;
              const XML_SPACE_WIDTH = 5.5;

              for (let i = 0; i < morphemes!.length; i++) {
                const pLen = morphemes![i].text.length;
                const pW = widths[i];
                if (charIdx + pLen <= baseIdx) {
                  sx += pW + gap;
                  charIdx += pLen;
                  continue;
                }
                const startOff = Math.max(0, baseIdx - charIdx);
                const ratio = pLen > 0 ? startOff / pLen : 0;
                stemStartX = sx + pW * ratio;
                break;
              }
              sx = 20;
              charIdx = 0;
              for (let i = 0; i < morphemes!.length; i++) {
                const pLen = morphemes![i].text.length;
                const pW = widths[i];
                if (charIdx + pLen < baseEnd) {
                  sx += pW + gap;
                  charIdx += pLen;
                  continue;
                }
                const endOff = Math.min(pLen, baseEnd - charIdx);
                const ratio = pLen > 0 ? endOff / pLen : 0;
                stemEndX = sx + pW * ratio + XML_SPACE_WIDTH;
                break;
              }
              stemEndX = stemEndX - XML_SPACE_WIDTH;
              const serif = 4;
              return (
                <g>
                  <line x1={stemStartX} y1={STEM_Y} x2={stemEndX} y2={STEM_Y} stroke="#475569" strokeWidth={1.5} />
                  <line x1={stemStartX} y1={STEM_Y} x2={stemStartX - serif} y2={STEM_Y - serif} stroke="#475569" strokeWidth={1.5} />
                  <line x1={stemStartX} y1={STEM_Y} x2={stemStartX - serif} y2={STEM_Y + serif} stroke="#475569" strokeWidth={1.5} />
                  <line x1={stemEndX} y1={STEM_Y} x2={stemEndX + serif} y2={STEM_Y - serif} stroke="#475569" strokeWidth={1.5} />
                  <line x1={stemEndX} y1={STEM_Y} x2={stemEndX + serif} y2={STEM_Y + serif} stroke="#475569" strokeWidth={1.5} />
                </g>
              );
            })()}
          </svg>

          <div className="flex flex-wrap justify-center gap-3 text-xs text-slate-500">{labelNodes}</div>

          {base && word.toLowerCase().includes(base.toLowerCase()) && (
            <span className="block text-xs text-slate-400 -mt-1">{t('morpheme.stem')} <b>{base}</b></span>
          )}
        </div>
      </div>
    </section>
  );
}