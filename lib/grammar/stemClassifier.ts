import { StemType } from './endingsRegistry';

export interface EnhancedDbItem {
    interslavic: string;
    protoSlavic: string;
    paradigm: 'A' | 'B' | 'C';
    gender: 'masculine' | 'feminine' | 'neuter' | 'verb';
    protoStemClass: string; // Данные из нашего нового JSON (ā, jā, o, jo, i, u, consonant)
    stemExtension?: string; // Данные из нашего нового JSON (en, es, et, er)
    stressPosition?: number | null; // Ударный слог от начала слова (0=первый), override penultimate
    morphemes?: { value: string; stressPosition?: number | null }[]; // Для вычисления ударения по морфемам
}

/**
 * Идеальный динамический определитель класса склонения на основе метаданных БД
 */
export function identifyStemTypeByDb(item: EnhancedDbItem): StemType {
    const { protoStemClass, stemExtension, gender } = item;

    // 1. Проверяем консонантные основы по наращению
    if (protoStemClass === 'consonant') {
        if (stemExtension === 'en') return 'consonant_n';
        if (stemExtension === 'es') return 'consonant_s';
    }

    // 2. Проверяем u-основы мужского рода напрямую из метаданных (syn, dom)
    if (protoStemClass === 'u' && gender === 'masculine') {
        return 'u_basis';
    }

    // 3. i-основы (kost, gost)
    if (protoStemClass === 'i') {
        return 'i_basis';
    }

    // 4. Твердые и мягкие ā-основы (женский род)
    if (protoStemClass === 'ā') return 'a_hard';
    if (protoStemClass === 'jā') return 'a_soft';

    // 5. Твердые и мягкие o-основы (мужской и средний род)
    if (protoStemClass === 'o') {
        return gender === 'neuter' ? 'a_hard' : 'o_hard';
    }
    if (protoStemClass === 'jo') {
        return gender === 'neuter' ? 'a_soft' : 'o_soft';
    }

    return 'o_hard'; // Дефолтный безопасный фоллбек
}
