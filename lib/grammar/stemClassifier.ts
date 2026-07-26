import { StemType } from './endingsRegistry';

export interface EnhancedDbItem {
    interslavic: string;
    protoSlavic: string;
    paradigm: 'A' | 'B' | 'C';
    gender: 'masculine' | 'feminine' | 'neuter' | 'verb';
    animacy?: string;
    protoStemClass: string; // Данные из нашего нового JSON (ā, jā, o, jo, i, u, consonant)
    stemExtension?: string; // Данные из нашего нового JSON (en, es, et, er)
    stressPosition?: number | null; // Ударный слог от начала слова (0=первый), override penultimate
    morphemes?: { value: string; stressPosition?: number | null }[]; // Для вычисления ударения по морфемам
}

/**
 * Идеальный динамический определитель класса склонения на основе метаданных БД
 */
export function resolveGender(gender: string | null | undefined, protoStemClass?: string): 'masculine' | 'feminine' | 'neuter' {
  if (gender) {
    const lower = gender.toLowerCase();
    if (lower === 'fem' || lower === 'feminine') return 'feminine';
    if (lower === 'masc' || lower === 'masculine') return 'masculine';
    if (lower === 'neuter' || lower === 'neut') return 'neuter';
  }
  if (protoStemClass === 'ā' || protoStemClass === 'jā' || protoStemClass === 'i') return 'feminine';
  if (protoStemClass === 'u') return 'masculine';
  return 'masculine';
}

export function identifyStemTypeByDb(item: EnhancedDbItem): StemType {
    const { gender } = item;

    // protoStemClass/stemExtension встречаются в двух формах: короткие нижнерегистровые
    // славистические коды из БД ('o'/'jo'/'i'/'u'/'ā'/'jā'/'consonant', 'en'/'es'/'ent'/'er')
    // и полные верхнерегистровые значения enum'ов ProtoStemClass/StemExtension ('O_SHORT',
    // 'CONSONANT', 'EN', ...), которыми исторически пользовались тесты и Stack B
    // (noun/index.ts, до его удаления при слиянии). Приводим к нижнему регистру перед
    // сравнением, как уже делает resolveGender() для рода — та же проблема, тот же фикс.
    const psc = String(item.protoStemClass).toLowerCase();
    const se = String(item.stemExtension).toLowerCase();

    // 1. Проверяем консонантные основы по наращению
    if (psc === 'consonant') {
        if (se === 'en') return 'consonant_n';
        if (se === 'es') return 'consonant_s';
        if (se === 'ent') return 'consonant_ent';
        if (se === 'er') return 'consonant_er';
    }

    // 2. Проверяем u-основы мужского рода напрямую из метаданных (syn, dom)
    if (psc === 'u' && gender === 'masculine') {
        return 'u_basis';
    }

    // 3. i-основы (kost, gost)
    if (psc === 'i') {
        return 'i_basis';
    }

    // 4. Твердые и мягкие ā-основы (женский род)
    if (psc === 'ā') return 'a_hard';
    if (psc === 'jā') return 'a_soft';

    // 5. Твердые и мягкие o-основы (мужской и средний род)
    if (psc === 'o') {
        return gender === 'neuter' ? 'a_hard' : 'o_hard';
    }
    if (psc === 'jo') {
        return gender === 'neuter' ? 'a_soft' : 'o_soft';
    }

    return 'o_hard'; // Дефолтный безопасный фоллбек
}
