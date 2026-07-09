'use client';

import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
} from 'recharts';

import {
  computePairwiseSimilarity,
} from '@/lib/levenshtein';

interface CognateRadarChartProps {
  item: any;
}

const GROUP_LANG_MAP: Record<string, string[]> = {
  southSlavic: ['bg', 'mk', 'sr', 'hr', 'sl'],
  eastSlavic: ['ru', 'uk', 'be'],
  westSlavic: ['pl', 'cs', 'sk', 'hsb', 'dsb'],
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
    let coefficient = computePairwiseSimilarity(translations);
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