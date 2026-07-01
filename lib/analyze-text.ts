// import { prismaData } from '@/lib/prisma';
import { mapNslToEtymologized, mapNslToStandard } from '@/lib/nsl';
import { standardToSimple } from '@/lib/isv';
import {init} from "@/lib/sqlite";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(process.cwd(), '.env.development') });

export interface WordAnalysis {
  original: string;
  normalized: string;
  lemma: string | null;
  inDatabase: boolean;
  databaseEntry: {
    id: number;
    value: string | null;
    pos: string | null;
  } | null;
}

export interface TextAnalysisResult {
  words: WordAnalysis[];
  unknownCandidates: WordAnalysis[];
  knownWords: WordAnalysis[];
}

const PUNCTUATION_REGEX = /[^a-zA-Zа-яА-ЯёЁѢѣѦѧѪѫіІїЇџЂђЋћЌќ0-9-]/g;

function normalizeWord(token: string): string {
  let word = token.toLowerCase().trim().replace(PUNCTUATION_REGEX, '');

  if (!word || word.length <= 1) return word;

  const hasCyrillic = /[а-яѢѣѦѧѪѫіїџђћќ]/.test(word);

  if (hasCyrillic) {
    const etymologized = mapNslToEtymologized(word);
    if (etymologized && etymologized !== word) return etymologized;
    const standard = mapNslToStandard(word);
    if (standard && standard !== word) return standard;
  }

  return word;
}

async function lookupWord(form: string): Promise<{
  id: number;
  value: string | null;
  pos: string | null;
} | null> {
  const db = await init();

  const searchForm = form.toLowerCase().trim();
  if (!searchForm || searchForm.length <= 1) return null;

  // const word = await prismaData.word.findFirst({
  //   where: {
  //     OR: [
  //       { value: searchForm },
  //       { nsl: searchForm },
  //       { isv: searchForm },
  //     ],
  //   },
  //   select: { id: true, value: true, pos: true },
  // });
  const stmt = db.prepare(`
    SELECT id, value, pos 
    FROM words 
    WHERE value = ? OR nsl = ? OR isv = ?
    LIMIT 1
  `);
  const word = stmt.get(searchForm, searchForm, searchForm);

  if (word) return word;

  const simple = standardToSimple(searchForm);
  if (simple && simple !== searchForm) {
    // const wordSimple = await prismaData.word.findFirst({
    //   where: {
    //     OR: [
    //       { value: simple },
    //       { isv: simple },
    //       { nsl: simple },
    //     ],
    //   },
    //   select: { id: true, value: true, pos: true },
    // });
    const stmt = db.prepare(`
      SELECT id, value, pos 
      FROM words 
      WHERE value = ? OR isv = ? OR nsl = ?
      LIMIT 1
    `);
    const wordSimple = stmt.get(simple, simple, simple);

    if (wordSimple) return wordSimple;
  }

  return null;
}

const ADJECTIVE_ENDINGS = [
  'yj', 'aja', 'oje', 'ogo', 'omu', 'ym', 'om',
  'ij', 'aja', 'oje', 'jego', 'jemu', 'im', 'jem',
  'yje', 'aja', 'yja', 'aja',
];

const NOUN_ENDING_SETS = [
  { endings: ['omъ', 'a', 'u', 'ě', 'e', 'y', 'i', 'ъ'], nomEndings: ['ъ', 'a', 'o'] },
  { endings: ['emъ', 'ju', 'ę', 'ixъ', 'i', 'a', 'u', 'e', 'ь'], nomEndings: ['ь', 'e', 'a'] },
  { endings: ['ojǫ', 'amъ', 'ami', 'ahъ', 'ǫ', 'y', 'ě'], nomEndings: ['a'] },
  { endings: ['ьjǫ', 'ьjъ', 'ьmъ', 'ьmi', 'ьxъ', 'i', 'ь'], nomEndings: ['ь'] },
  { endings: ['ovi', 'ъmъ', 'ove', 'ovъ', 'ъmi', 'ъxъ', 'u', 'y', 'ъ'], nomEndings: ['ъ'] },
];

const VERB_ENDING_SETS = [
  {
    endings: ['ajų', 'aješ', 'aje', 'ajevě', 'ajeta', 'ajemo', 'ajete', 'ajųt'],
    infSuffixes: ['ati', 'ovati'],
  },
  {
    endings: ['uješ', 'uje', 'ujevě', 'ujeta', 'ujemo', 'ujete', 'ujųt'],
    infSuffixes: ['ovati'],
  },
  {
    endings: ['neš', 'ne', 'nevě', 'neta', 'nemo', 'nete', 'nųt', 'nų'],
    infSuffixes: ['nuti', 'nųti'],
  },
  {
    endings: ['š', 'i', 'ivě', 'ita', 'imo', 'ite', 'ęt', 'ų'],
    infSuffixes: ['iti', 'ěti'],
  },
  {
    endings: ['eš', 'e', 'evě', 'eta', 'emo', 'ete', 'ųt', 'ų'],
    infSuffixes: ['ti', 'kti', 'gti', 'sti'],
  },
];

function tryLemmatizeNoun(form: string): string[] {
  const candidates: string[] = [];

  for (const { endings, nomEndings } of NOUN_ENDING_SETS) {
    for (const ending of endings) {
      if (form.endsWith(ending) && form.length > ending.length + 1) {
        const stem = form.slice(0, -ending.length);

        for (const nomEnding of nomEndings) {
          const candidate = stem + nomEnding;
          if (candidate.length >= 2) candidates.push(candidate);
        }

        if (stem.length >= 2) candidates.push(stem);
      }
    }
  }

  for (const ending of ADJECTIVE_ENDINGS) {
    if (form.endsWith(ending) && form.length > ending.length + 1) {
      const stem = form.slice(0, -ending.length);
      if (stem.length >= 2) {
        candidates.push(stem);
        candidates.push(stem + 'y');
        candidates.push(stem + 'i');
      }
    }
  }

  return candidates;
}

function tryLemmatizeVerb(form: string): string[] {
  const candidates: string[] = [];

  for (const { endings, infSuffixes } of VERB_ENDING_SETS) {
    for (const ending of endings) {
      if (form.endsWith(ending) && form.length > ending.length + 2) {
        const stem = form.slice(0, -ending.length);

        for (const infSuffix of infSuffixes) {
          candidates.push(stem + infSuffix);
        }

        if (ending.startsWith('uje') || ending.startsWith('aj')) {
          candidates.push(stem + 'ati');
        }
      }
    }
  }

  return candidates;
}

async function tryLemmatize(form: string): Promise<string | null> {
  const nounCandidates = tryLemmatizeNoun(form);

  for (const candidate of nounCandidates) {
    const entry = await lookupWord(candidate);
    if (entry) return candidate;
  }

  const verbCandidates = tryLemmatizeVerb(form);

  for (const candidate of verbCandidates) {
    const entry = await lookupWord(candidate);
    if (entry) return candidate;
  }

  return null;
}

export async function analyzeText(text: string): Promise<TextAnalysisResult> {
  const tokens = text.match(/[а-яѢѣѦѧѪѫіїџђћќa-zA-Zěščžńųęǫ.-]+/g) || [];

  const wordAnalyses: WordAnalysis[] = [];

  for (const token of tokens) {
    const normalized = normalizeWord(token);

    if (!normalized || normalized.length <= 1) continue;

    let dbEntry = await lookupWord(normalized);

    let lemma: string | null = null;

    if (!dbEntry) {
      lemma = await tryLemmatize(normalized);

      if (lemma) {
        dbEntry = await lookupWord(lemma);
      }
    }

    if (dbEntry && !lemma) {
      lemma = normalized;
    }

    wordAnalyses.push({
      original: token,
      normalized,
      lemma,
      inDatabase: !!dbEntry,
      databaseEntry: dbEntry,
    });
  }

  return {
    words: wordAnalyses,
    unknownCandidates: wordAnalyses.filter((w) => !w.inDatabase),
    knownWords: wordAnalyses.filter((w) => w.inDatabase),
  };
}