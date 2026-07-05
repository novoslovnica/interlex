'use client';
import { useMemo } from 'react';
import { MorphemeType, type MorphemePart } from '@/lib/grammar/common';

interface MorphemeAnalysisProps {
  word: string;
  roots: { id: number; value: string; type: number }[] | null | undefined;
  base: string | null | undefined;
  currentScript: string;
}

function isNumeric(value: string): boolean {
  return /^\d+$/.test(value);
}

const STRING_TO_TYPE: Record<string, MorphemeType> = {
  ROOT: MorphemeType.ROOT,
  PREFIX: MorphemeType.PREFIX,
  SUFFIX: MorphemeType.SUFFIX,
  UNKNOWN: MorphemeType.UNKNOWN,
};

function normalizeType(type: any): MorphemeType {
  if (typeof type === 'number') return type;
  if (typeof type === 'string') return STRING_TO_TYPE[type] ?? MorphemeType.UNKNOWN;
  return MorphemeType.UNKNOWN;
}

function extractMorphemes(word: string, roots: { id: number; value: string; type: number }[] | null | undefined): MorphemePart[] | null {
  if (!roots || roots.length === 0) return null;

  const wordLower = word.toLowerCase();
  const matches: { start: number; end: number; text: string }[] = [];

  for (const root of roots) {
    if (!root.value || isNumeric(root.value)) continue;
    const rootLower = root.value.toLowerCase();
    let pos = 0;
    while ((pos = wordLower.indexOf(rootLower, pos)) !== -1) {
      matches.push({ start: pos, end: pos + root.value.length, text: word.slice(pos, pos + root.value.length) });
      pos++;
    }
  }

  if (matches.length === 0) return null;

  matches.sort((a, b) => a.start - b.start || (b.end - b.start) - (a.end - a.start));

  const resolved: typeof matches = [];
  let lastEnd = 0;
  for (const m of matches) {
    if (m.start >= lastEnd) {
      resolved.push(m);
      lastEnd = m.end;
    }
  }

  const parts: MorphemePart[] = [];
  let cursor = 0;

  for (const m of resolved) {
    if (m.start > cursor) {
      parts.push({ type: cursor === 0 ? MorphemeType.PREFIX : MorphemeType.UNKNOWN, text: word.slice(cursor, m.start) });
    }
    parts.push({ type: MorphemeType.ROOT, text: m.text });
    cursor = m.end;
  }

  if (cursor < word.length) {
    parts.push({ type: MorphemeType.SUFFIX, text: word.slice(cursor) });
  }

  if (!parts.some(p => p.type === MorphemeType.ROOT)) return null;
  return parts;
}

const COLOR: Record<MorphemeType, string> = {
  [MorphemeType.ROOT]: '#2563eb',
  [MorphemeType.PREFIX]: '#d97706',
  [MorphemeType.SUFFIX]: '#16a34a',
  [MorphemeType.UNKNOWN]: '#cbd5e1',
};

const LABEL: Record<MorphemeType, string> = {
  [MorphemeType.ROOT]: 'корень',
  [MorphemeType.PREFIX]: 'приставка',
  [MorphemeType.SUFFIX]: 'суффикс',
  [MorphemeType.UNKNOWN]: 'соединительный элемент',
};

function measureWidths(parts: { text: string }[]): number[] {
  if (typeof document === 'undefined') {
    // В моноширинном шрифте 20px соотношение сторон ~0.6, то есть 12px на символ
    return parts.map(p => p.text.length * 12);
  }

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return parts.map(p => p.text.length * 12);

  // Обязательно добавляем "500", чтобы вес шрифта в Canvas точно совпадал с SVG
  ctx.font = '500 20px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace';

  return parts.map(p => {
    const width = ctx.measureText(p.text).width;
    // Если Canvas вернул 0 или измерил некорректно из-за непрогрузившегося шрифта,
    // используем надежный математический фолбек для моноширины
    return width > 0 ? width : p.text.length * 12;
  });
}

export default function MorphemeAnalysis({ word, roots, base }: MorphemeAnalysisProps) {
  const raw = useMemo(() => extractMorphemes(word, roots), [word, roots]);

  const morphemes: MorphemePart[] | null = raw;

  const widths = useMemo(() => morphemes ? measureWidths(morphemes) : [], [morphemes]);
  const gap = 8;
  const totalW = widths.reduce((s, w) => s + w, 0) + (morphemes ? (morphemes.length - 1) * gap : 0);
  const svgWidth = Math.max(280, totalW + 40);
  const MARK_Y = 22;
  const ARC_TOP = 12;
  const TEXT_Y = 40;
  const STEM_Y = 48;

  const hasVisible = morphemes !== null && morphemes.some(p => normalizeType(p.type) !== MorphemeType.UNKNOWN);

  if (!hasVisible) {
    return (
      <section className="mb-6">
        <h2 className="text-lg font-bold text-slate-800 border-l-4 border-blue-600 pl-3 mb-3">Морфемный разбор</h2>
        <div className="bg-slate-50 border border-slate-100 rounded-xl p-6 text-center text-slate-400 italic text-sm">
          <span className="text-xl font-mono tracking-wide text-slate-300">{word}</span>
          <p className="mt-2">Морфемный анализ недоступен — данные корня отсутствуют</p>
        </div>
      </section>
    );
  }

  let x = 20;
  const nodes: React.ReactNode[] = [];
  const labelNodes: React.ReactNode[] = [];

  for (let i = 0; i < morphemes!.length; i++) {
    const part = morphemes![i];
    const type = normalizeType(part.type);
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
      <h2 className="text-lg font-bold text-slate-800 border-l-4 border-blue-600 pl-3 mb-3">Морфемный разбор</h2>
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
            <span className="block text-xs text-slate-400 -mt-1">Основа слова: <b>{base}</b></span>
          )}
        </div>
      </div>
    </section>
  );
}