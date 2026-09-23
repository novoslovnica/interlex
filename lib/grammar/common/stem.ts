import { foldDiacritics } from '@/lib/corpus/tokenizer/foldDiacritics';

/**
 * Каноническое написание слова: value в словаре часто записан без диакритики
 * ("treba", "velmi", "ze"), а стем — с ней ("trěba", "veľmi", "že"). Если они
 * различаются только диакритикой, канон — стем.
 *
 * Тот же приём, что у canonicalInfinitive (verb/index.ts) и
 * canonicalPronounLemma (pronoun/index.ts); у глаголов правило шире — там
 * стем ещё достраивается до инфинитива и отбрасывается механический хвост,
 * поэтому та функция не сводится к этой.
 */
export function canonicalFromStem(value: string | null | undefined, stem: string | null | undefined): string {
    const v = (value ?? '').toLowerCase().trim();
    const s = (stem ?? '').toLowerCase().trim();
    if (!s) return v;
    const fv = foldDiacritics(v);
    const fs = foldDiacritics(s);
    if (fs === fv) return s;
    // Стем без конечной гласной: у ~600 наречий value "takoze", стем "takož".
    // Канон - стем с дописанным хвостом value ("takože"), иначе движок не
    // порождает правильное написание вовсе, а только упрощённое.
    const tailLength = fv.length - fs.length;
    if (tailLength > 0 && tailLength <= 2 && fv.startsWith(fs)) {
        const candidate = s + v.slice(v.length - tailLength);
        if (foldDiacritics(candidate) === fv) return candidate;
    }
    return v;
}

export enum ProtoStemClass {
    A_LONG    = 'A_LONG',    // Основы на *-ā (древние твердые женского/мужского рода: *voda, *sluga)
    JA_LONG   = 'JA_LONG',   // Основы на *-jā (древние мягкие женского/мужского рода: *zemlja, *duša)
    O_SHORT   = 'O_SHORT',   // Основы на *-o (твердые мужского/среднего рода: *domъ, *selo)
    JO_SHORT  = 'JO_SHORT',  // Основы на *-jo (мягкие мужского/среднего рода: *kon’ь, *pole)
    I_SHORT   = 'I_SHORT',   // Основы на *-i (женский и мужской род: *kostь, *gostь)
    U_LONG    = 'U_LONG',    // Основы на *-ū (древний долгий u, женский род: *creky, *ljuby)
    U_SHORT   = 'U_SHORT',   // Основы на *-u (краткий u, мужской род, перешедший в o-основы: *synъ, *medъ)
    CONSONANT = 'CONSONANT'  // Консонантные основы (на согласный: *-en, *-es, *-ent, *-er)
}

export enum StemExtension {
    EN  = 'EN',  // Наращение на *-en (мужской/средний род: *imę -> imene)
    ES  = 'ES',  // Наращение на *-es (средний род: *slovo -> slovesa)
    ENT = 'ENT', // Наращение на *-ent / *-ęt (детеныши: *telę -> telęte / telenti)
    ER  = 'ER',  // Наращение на *-er (термины родства: *mati -> matere)
    NONE = 'NONE'
}
