'use client';

import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
} from 'recharts';

interface CognateRadarChartProps {
  item: any;
}

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = Math.min(dp[i - 1][j - 1] + 1, dp[i - 1][j] + 1, dp[i][j - 1] + 1);
      }
    }
  }
  return dp[m][n];
}

const CYRILLIC_TO_LATIN: Record<string, string> = {
  'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd',
  'е': 'e', 'ё': 'e', 'ж': 'ž', 'з': 'z', 'и': 'i',
  'й': 'j', 'к': 'k', 'л': 'l', 'м': 'm', 'н': 'n',
  'о': 'o', 'п': 'p', 'р': 'r', 'с': 's', 'т': 't',
  'у': 'u', 'ф': 'f', 'х': 'h', 'ц': 'c', 'ч': 'č',
  'ш': 'š', 'щ': 'št', 'ъ': '', 'ы': 'y', 'ь': '',
  'э': 'e', 'ю': 'ju', 'я': 'ja',
  'і': 'i', 'ї': 'ji', 'є': 'je', 'ґ': 'g',
  'ў': 'u', 'џ': 'dž', 'ѓ': 'g', 'ѕ': 'dz',
  'ѝ': 'i', 'ћ': 'ć', 'ѐ': 'e',
};

function transliterateToLatin(text: string): string {
  let result = '';
  for (const ch of text.toLowerCase()) {
    result += CYRILLIC_TO_LATIN[ch] || ch;
  }
  return result;
}

function normalizeText(text: string): string {
  return transliterateToLatin(text).trim().replace(/\s+/g, ' ');
}

function splitTranslations(values: string[]): string[] {
  const result: string[] = [];
  for (const v of values) {
    if (!v) continue;
    for (const part of v.split(',')) {
      const trimmed = part.trim();
      if (trimmed) result.push(normalizeText(trimmed));
    }
  }
  return result;
}

function computeGroupCoefficient(translations: string[]): number {
  const normalized = splitTranslations(translations);
  if (normalized.length < 2) return 0;

  let totalDist = 0;
  let maxDist = 0;
  let pairs = 0;

  for (let i = 0; i < normalized.length; i++) {
    for (let j = i + 1; j < normalized.length; j++) {
      const dist = levenshtein(normalized[i], normalized[j]);
      totalDist += dist;
      if (dist > maxDist) maxDist = dist;
      pairs++;
    }
  }

  if (maxDist === 0) return 1;

  const avgDist = totalDist / pairs;
  return 1 - avgDist / maxDist;
}

const GROUP_LANG_MAP: Record<string, string[]> = {
  southSlavic: ['bg', 'mk', 'sr', 'hr', 'sl'],
  eastSlavic: ['ru', 'uk', 'be'],
  westSlavic: ['pl', 'cs', 'sk'],
  romance: ['eo'],
  germanic: ['de', 'nl'],
  greek: [],
};

const GENESIS_TO_GROUP: Record<string, string> = {
  'ru': 'eastSlavic',
  'v': 'eastSlavic',
  'bg': 'southSlavic',
  'mk': 'southSlavic',
  'sr': 'southSlavic',
  'hr': 'southSlavic',
  'sl': 'southSlavic',
  'sh': 'southSlavic',
  'j': 'southSlavic',
  'pl': 'westSlavic',
  'cs': 'westSlavic',
  'cz': 'westSlavic',
  'sk': 'westSlavic',
  'z': 'westSlavic',
  'I': 'romance',
  'F': 'romance',
  'S': 'romance',
  'E': 'germanic',
  'D': 'germanic',
};

const GROUP_LABELS: Record<string, string> = {
  southSlavic: 'Южнославянские',
  eastSlavic: 'Восточнославянские',
  westSlavic: 'Западнославянские',
  romance: 'Романские',
  germanic: 'Германские',
  greek: 'Греческий',
};

function parseGenesis(genesis: string | null | undefined): string[] {
  if (!genesis || genesis.trim() === '') return [];
  return genesis.trim().split(/\s+/);
}

export default function CognateRadarChart({ item }: CognateRadarChartProps) {
  const genesisCodes = parseGenesis(item.genesis);
  const genesisGroups = new Set(genesisCodes.map(c => GENESIS_TO_GROUP[c]).filter(Boolean));

  const groups = ['southSlavic', 'eastSlavic', 'westSlavic', 'romance', 'germanic', 'greek'] as const;

  const data = groups.map(key => {
    const langCodes = GROUP_LANG_MAP[key];
    const translations: string[] = [];
    for (const code of langCodes) {
      const langData = item[code];
      if (Array.isArray(langData)) {
        for (const entry of langData) {
          if (entry.value) translations.push(entry.value);
        }
      }
    }
    let coefficient = computeGroupCoefficient(translations);
    if (genesisGroups.has(key)) {
      coefficient = 1;
    }
    return {
      group: GROUP_LABELS[key],
      coefficient: Math.round(coefficient * 100) / 100,
    };
  });

  return (
    <section className="mb-6">
      <h2 className="text-lg font-bold text-slate-800 border-l-4 border-blue-600 pl-3 mb-3">
        Диаграмма когнатов
      </h2>
      <div className="bg-slate-50 border border-slate-100 rounded-xl p-4">
        <ResponsiveContainer width="100%" height={400}>
          <RadarChart data={data} cx="50%" cy="50%" outerRadius="70%">
            <PolarGrid stroke="#cbd5e1" />
            <PolarAngleAxis dataKey="group" tick={{ fill: '#475569', fontSize: 12 }} />
            <PolarRadiusAxis angle={30} domain={[0, 1]} tick={{ fill: '#94a3b8', fontSize: 10 }} />
            <Radar
              name="Когнаты"
              dataKey="coefficient"
              stroke="#3b82f6"
              fill="#3b82f6"
              fillOpacity={0.2}
            />
          </RadarChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}