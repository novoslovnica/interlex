export function normalizeSoftConsonants(text: string): string {
  if (!text) return ""
  return text
    .replace(/[Ľľ](?=[ieęě])/g, (m) => m === 'Ľ' ? 'L' : 'l')
    .replace(/[Ťť](?=[ieęě])/g, (m) => m === 'Ť' ? 'T' : 't')
    .replace(/[Ďď](?=[ieęě])/g, (m) => m === 'Ď' ? 'D' : 'd')
    .replace(/[Ňň](?=[ieęě])/g, (m) => m === 'Ň' ? 'N' : 'n')
    .replace(/[Śś](?=[ieęě])/g, (m) => m === 'Ś' ? 'S' : 's')
    .replace(/[Źź](?=[ieęě])/g, (m) => m === 'Ź' ? 'Z' : 'z')
    .replace(/[Ćć](?=[ieęě])/g, (m) => m === 'Ć' ? 'Č' : 'č')
    .replace(/[Đđ](?=[ieęě])/g, (m) => m === 'Đ' ? 'D' : 'd')
    // Уже мягкая согласная сама по себе несёт палатализацию — если следом идёт
    // ещё и явное 'j' (напр. типовое i-основное окончание Nom/Acc sg), это
    // задвоение, и его нужно убрать: pęť + j -> pęť, noć + j -> noć.
    .replace(/([ĽľŤťĎďŇňŚśŹźĆćĐđ])[jJ]/g, (_m, c) => c)
}

export function collapseDoubleJ(text: string): string {
  if (!text) return ""
  return text.replace(/jj/g, 'j').replace(/JJ/g, 'J')
}

export const isvToCyrOld = (text: string) => {
    if (!text) return "";

    // Шаг 0: Нормализация мягких согласных перед i, e, ę, ě
    const normalized = normalizeSoftConsonants(text);

    // Шаг 1: Замена лигатур и диграфов (Dž, Št, Ks)
    const processed = normalized
        .replace(/Dž/g, 'Џ').replace(/dž/g, 'џ')
        .replace(/Št/g, 'Щ').replace(/št/g, 'щ');
        // .replace(/Ks/g, 'Ќ').replace(/ks/g, 'ќ')
        // .replace(/Ps/g, 'Ѱ').replace(/ps/g, 'ѱ');

    // Шаг 2: Посимвольный маппинг всех букв.
    // Ключи СТРОГО проверены на латинскую раскладку (ASCII).
    const rules = {
        // Согласные (слева латиница, справа кириллица)
        'B': 'Б', 'b': 'б',
        'V': 'В', 'v': 'в',
        'G': 'Г', 'g': 'г',
        'D': 'Д', 'd': 'д',
        'Ž': 'Ж', 'ž': 'ж',
        'Z': 'З', 'z': 'з',
        'P': 'П', 'p': 'п',
        'F': 'Ф', 'f': 'ф',
        'H': 'Х', 'h': 'х',
        'K': 'К', 'k': 'к',
        'T': 'Т', 't': 'т',
        'Č': 'Ч', 'č': 'ч',
        'Š': 'Ш', 'š': 'ш',
        'S': 'С', 's': 'с',
        'C': 'Ц', 'c': 'ц',
        'L': 'Л', 'l': 'л',
        'M': 'М', 'm': 'м',
        'N': 'Н', 'n': 'н',
        'R': 'Р', 'r': 'р',

        // Переход латинского j в кириллический йот і
        'J': 'І', 'j': 'і',

        // Базовые гласные
        'A': 'А', 'a': 'а',
        'E': 'Е', 'e': 'е',
        'I': 'И', 'i': 'и',
        'O': 'О', 'o': 'о',
        'U': 'У', 'u': 'у',
        'Y': 'Ы', 'y': 'ы',

        // Исторические и этимологические соответствия
        'Ě': 'Ѣ', 'ě': 'ѣ',
        'Ę': 'Ѧ', 'ę': 'ѧ',
        'Ų': 'Ѫ', 'ų': 'ѫ',
        ...JER_AND_LENGTH_CYR,
    };

    let result = "";

    // Шаг 3 (старый): Посимвольная сборка текста
    for (let i = 0; i < processed.length; i++) {
        const char = processed[i];

        if (rules.hasOwnProperty(char)) {
            result += rules[char];
        } else {
            result += char;
        }
    }

    // Шаг 4 (старый): Пост-процессинг мягких согласных с ерь (ь)
    result = result
        .replace(/Ľ/g, 'ЛЬ').replace(/ľ/g, 'ль')
        .replace(/Ť/g, 'ТЬ').replace(/ť/g, 'ть')
        .replace(/Ď/g, 'ДЬ').replace(/ď/g, 'дь')
        .replace(/Ň/g, 'НЬ').replace(/ň/g, 'нь')
        .replace(/Ś/g, 'СЬ').replace(/ś/g, 'сь')
        .replace(/Ź/g, 'ЗЬ').replace(/ź/g, 'зь')
        .replace(/Ć/g, 'Ћ').replace(/ć/g, 'ћ')
        .replace(/Đ/g, 'ДЬ').replace(/đ/g, 'дь')
        // Слоговые ŕ/ĺ и ń — по тому же правилу, что и мягкие выше.
        .replace(/Ŕ/g, 'РЬ').replace(/ŕ/g, 'рь')
        .replace(/Ĺ/g, 'ЛЬ').replace(/ĺ/g, 'ль')
        .replace(/Ń/g, 'НЬ').replace(/ń/g, 'нь');

    return transliterateAccented(result, rules);
}

export const isvToCyrNew = (text: string) => {
    if (!text) return "";

    // Шаг 0: Нормализация мягких согласных перед i, e, ę, ě
    const normalized = normalizeSoftConsonants(text);

    // Шаг 1: Замена лигатур и диграфов (Dž, Št, Ks)
    const processed = normalized
        .replace(/Dž/g, 'Џ').replace(/dž/g, 'џ')
        .replace(/Št/g, 'Щ').replace(/št/g, 'щ');
        // .replace(/Ks/g, 'Ќ').replace(/ks/g, 'ќ')
        // .replace(/Ps/g, 'Ѱ').replace(/ps/g, 'ѱ');

    // Шаг 2: Посимвольный маппинг всех букв.
    const rules = {
        'B': 'Б', 'b': 'б',
        'V': 'В', 'v': 'в',
        'G': 'Г', 'g': 'г',
        'D': 'Д', 'd': 'д',
        'Ž': 'Ж', 'ž': 'ж',
        'Z': 'З', 'z': 'з',
        'P': 'П', 'p': 'п',
        'F': 'Ф', 'f': 'ф',
        'H': 'Х', 'h': 'х',
        'K': 'К', 'k': 'к',
        'T': 'Т', 't': 'т',
        'Č': 'Ч', 'č': 'ч',
        'Š': 'Ш', 'š': 'ш',
        'S': 'С', 's': 'с',
        'C': 'Ц', 'c': 'ц',
        'L': 'Л', 'l': 'л',
        'M': 'М', 'm': 'м',
        'N': 'Н', 'n': 'н',
        'R': 'Р', 'r': 'р',

        // Переход латинского j в кириллический йот і
        'J': 'І', 'j': 'і',

        // Базовые гласные
        'A': 'А', 'a': 'а',
        'E': 'Е', 'e': 'е',
        'I': 'И', 'i': 'и',
        'O': 'О', 'o': 'о',
        'U': 'У', 'u': 'у',
        'Y': 'Ы', 'y': 'ы',

        // Исторические и этимологические соответствия
        'Ě': 'Ѣ', 'ě': 'ѣ',
        'Ę': 'Ѧ', 'ę': 'ѧ',
        'Ų': 'Ѫ', 'ų': 'ѫ',
        ...JER_AND_LENGTH_CYR,
    };

    let result = "";

    // Шаг 3: Посимвольная сборка текста
    for (let i = 0; i < processed.length; i++) {
        const char = processed[i];

        if (rules.hasOwnProperty(char)) {
            result += rules[char];
        } else {
            result += char;
        }
    }

    // Шаг 4: Пост-процессинг мягких согласных с йотом (і) вместо ерь (ь)
    result = result
        .replace(/Ľ/g, 'ЛІ').replace(/ľ/g, 'лі')
        .replace(/Ť/g, 'ТІ').replace(/ť/g, 'ті')
        .replace(/Ď/g, 'ДІ').replace(/ď/g, 'ді')
        .replace(/Ň/g, 'НІ').replace(/ň/g, 'ні')
        .replace(/Ś/g, 'СІ').replace(/ś/g, 'сі')
        .replace(/Ź/g, 'ЗІ').replace(/ź/g, 'зі')
        .replace(/Ć/g, 'Ћ').replace(/ć/g, 'ћ')
        .replace(/Đ/g, 'ДІ').replace(/đ/g, 'ді')
        .replace(/Ŕ/g, 'РІ').replace(/ŕ/g, 'рі')
        .replace(/Ĺ/g, 'ЛІ').replace(/ĺ/g, 'лі')
        .replace(/Ń/g, 'НІ').replace(/ń/g, 'ні');

    return transliterateAccented(result, rules);
}

export const isvToCyr = isvToCyrOld;

export const isvToTranscription = (etymologicalWord: string) => {
    if (!etymologicalWord) return "[]";

    // Приводим к нижнему регистру для упрощения разбора
    let str = etymologicalWord.toLowerCase().trim();

    // Нормализация мягких согласных перед i, e, ę, ě
    str = normalizeSoftConsonants(str);

    // 1. Предварительная замена сложных аффрикат, лигатур и мягких согласных
    str = str
        .replace(/dž/g, 'd͡ʒ')  // аффриката џ
        .replace(/št/g, 'ʃt')  // лигатура щ
        .replace(/č/g, 't͡ʃ')   // ч
        .replace(/c/g, 't͡s')   // ц
        // Мягкие согласные (оставшиеся после нормализации: перед a/o/u/ǫ и в конце слов)
        .replace(/ľ/g, 'lʲ')
        .replace(/ť/g, 'tʲ')
        .replace(/ď/g, 'dʲ')
        .replace(/ň/g, 'nʲ')
        .replace(/ś/g, 'sʲ')
        .replace(/ź/g, 'zʲ')
        .replace(/ć/g, 'tɕ')
        .replace(/đ/g, 'dʑ');

    // 2. Обработка простых шипящих
    str = str
        .replace(/ž/g, 'ʒ')
        .replace(/š/g, 'ʃ')
        .replace(/h/g, 'x'); // х передается как велярный [x]

    // 3. Контекстная обработка 'j' (Смягчение согласных vs Звук [j])
    const ipaChars = [];
    const vowels = ['a', 'e', 'ě', 'i', 'y', 'o', 'u', 'ę', 'ǫ', 'ų'];

    for (let i = 0; i < str.length; i++) {
        const char = str[i];

        if (char === 'j') {
            const prevChar = i > 0 ? str[i - 1] : '';
            const nextChar = i < str.length - 1 ? str[i + 1] : '';

            // Если 'j' стоит МЕЖДУ согласной и гласной (например, "zemjla")
            // или после согласной на конце слова, она обозначает мягкость (палатализацию)
            if (prevChar && !vowels.includes(prevChar) && prevChar !== ' ' && prevChar !== '-') {
                // Добавляем знак палатализации к предыдущему символу
                ipaChars.push('ʲ');

                // Если после этой 'j' идет гласная, саму 'j' мы больше не пишем (мягкость ушла в согласную)
                if (nextChar && vowels.includes(nextChar)) {
                    continue;
                }
            } else {
                // Если 'j' в начале слова или после гласной, это полноценный звук [j]
                ipaChars.push('j');
            }
        } else {
            // Замена гласных согласно стандартам МФА
            if (char === 'ě' || char === 'e') {
                ipaChars.push('ɛ');
            } else if (char === 'o') {
                ipaChars.push('ɔ');
            } else if (char === 'y') {
                ipaChars.push('i'); // в праславянском/межславянском ы и и близки к [i]
            } else if (char === 'ę') {
                ipaChars.push('ɛ̃'); // Носовой малый юс
            } else if (char === 'ǫ' || char === 'ų') {
                ipaChars.push('ɔ̃'); // Носовой большой юс (совр. орфография: ų)
            } else {
                ipaChars.push(char);
            }
        }
    }

    // Собираем массив в строку и оборачиваем в стандартные квадратные скобки МФА
    return `[${ipaChars.join('')}]`;
}

export const standardToSimple = (text: string) => {
    if (!text) return "";

    // Шаг 0: Нормализация мягких согласных перед i, e, ę, ě
    const normalized = normalizeSoftConsonants(text);

    // Шаг 1: Сжатие этимологических окончаний прилагательных на границах слов (-yj/-ij -> -y/-i)
    const processed = normalized
        .replace(/yj(?![▲\p{L}])/gu, 'y')
        .replace(/ij(?![▲\p{L}])/gu, 'i')
        .replace(/YJ(?![▲\p{L}])/gu, 'Y')
        .replace(/IJ(?![▲\p{L}])/gu, 'I');

    // Шаг 2: Перевод носовых гласных и ятя в упрощенный вид
    const fixedRules = {
        'Ě': 'E', 'ě': 'e', // Ять -> E
        'Ę': 'E', 'ę': 'e', // Малый юс -> E
        'Ǫ': 'U', 'ǫ': 'u', // Большой юс (устар. написание o+огонек) -> U
        'Ų': 'U', 'ų': 'u', // Большой юс (совр. написание u+огонек) -> U
        'Å': 'A', 'å': 'a', 'Ė': 'E', 'ė': 'e', 'Ȯ': 'O', 'ȯ': 'o', // долгое a и еры
        'Ŕ': 'R', 'ŕ': 'r', 'Ĺ': 'L', 'ĺ': 'l', 'Ń': 'N', 'ń': 'n', // слоговые и мягкое n
    };

    const step2 = processed.split('').map(char => fixedRules.hasOwnProperty(char) ? fixedRules[char] : char).join('');

    // Шаг 3: Перевод сочетаний с 'j' в формат 'i' + твёрдая гласная (согласно правилу первой функции)
    // Исключение: если перед 'j' уже стоит 'i', то 'j' просто поглощается (чтобы не было триплексов 'iia')
    let result = "";

    for (let i = 0; i < step2.length; i++) {
        const char = step2[i];

        if (char === 'j' || char === 'J') {
            const prevChar = result.length > 0 ? result[result.length - 1].toLowerCase() : '';
            const nextChar = i < step2.length - 1 ? step2[i + 1].toLowerCase() : '';
            const softableVowels = ['a', 'u', 'e', 'o'];

            // Если после j идет гласная, которую нужно смягчить
            if (nextChar && softableVowels.includes(nextChar)) {
                // Если перед j уже стоит латинская 'i', мы её пропускаем (j стирается, остается только гласная)
                if (prevChar === 'i') {
                    continue;
                } else {
                    // В обычном контексте j превращается в i
                    result += (char === 'J') ? 'I' : 'i';
                }
            } else {
                // Если это одиночная j на конце или перед согласной (например, в словах типа "kraj")
                result += char;
            }
        } else {
            result += char;
        }
    }

    // Шаг 4: Упрощение оставшихся мягких согласных (перед a/o/u/ǫ, в конце слова, перед согласными)
    result = result
        .replace(/[Ľľ]/g, (m) => m === 'Ľ' ? 'L' : 'l')
        .replace(/[Ťť]/g, (m) => m === 'Ť' ? 'T' : 't')
        .replace(/[Ďď]/g, (m) => m === 'Ď' ? 'D' : 'd')
        .replace(/[Ňň]/g, (m) => m === 'Ň' ? 'N' : 'n')
        .replace(/[Śś]/g, (m) => m === 'Ś' ? 'S' : 's')
        .replace(/[Źź]/g, (m) => m === 'Ź' ? 'Z' : 'z')
        .replace(/[Ćć]/g, (m) => m === 'Ć' ? 'C' : 'c')
        .replace(/[Đđ]/g, (m) => m === 'Đ' ? 'D' : 'd');

    return result;
}

// Еры и долгое å в этимологической кириллице (выбор мейнтейнера, 2026-09-15):
// сильные еры ȯ/ė пишутся самими ерами, å — «а» с кольцом (U+030A). Слоговые
// ŕ/ĺ и ń идут через ерь по тому же правилу, что уже действовало для ľ/ť/ď
// (шаг 4 в isvToCyrOld/isvToCyrNew). Раньше все шесть букв проходили в
// кириллицу латиницей: «подвŕгнѫти», «актоŕскы».
const JER_AND_LENGTH_CYR: Record<string, string> = {
    'Ȯ': 'Ъ', 'ȯ': 'ъ',
    'Ė': 'Ь', 'ė': 'ь',
    'Å': 'А̊', 'å': 'а̊',
};

// Латинская буква с тоновым знаком, которой нет в таблице (ó, è, ȁ...):
// базовая буква транслитерируется, знак остаётся комбинирующим — «мо́ре»,
// а не «мóре» с латинской ó посреди кириллицы.
function transliterateAccented(text: string, rules: Record<string, string>): string {
    let out = "";
    for (const ch of text) {
        const decomposed = ch.normalize("NFD");
        const mapped = decomposed.length > 1 ? rules[decomposed[0]] : undefined;
        out += mapped ? mapped + decomposed.slice(1) : ch;
    }
    return out;
}

export const isvToGlagolitic = (input: string): string => {
  if (!input) return "";

  // Та же нормализация мягких перед i/e/ę/ě, что и в кириллице.
  const text = normalizeSoftConsonants(input.normalize("NFC"));

  const lower = (ch: string) => ch.toLowerCase();

  // Мягкие и слоговые согласные — базовая буква + ерь (ⱐ), как в кириллице
  // (ľ -> ль); ȯ/ė — сами еры. ć — джерв ⰼ (глаголический источник ћ, которым
  // ć передаётся в кириллице), đ — ⰴⱐ, как «дь».
  const glagoliticLower: Record<string, string> = {
    'a': 'ⰰ', 'b': 'ⰱ', 'v': 'ⰲ', 'g': 'ⰳ', 'd': 'ⰴ',
    'e': 'ⰵ', 'ž': 'ⰶ', 'z': 'ⰸ', 'i': 'ⰹ', 'j': 'ⰻ',
    'k': 'ⰽ', 'l': 'ⰾ', 'm': 'ⰿ', 'n': 'ⱀ', 'o': 'ⱁ',
    'p': 'ⱂ', 'r': 'ⱃ', 's': 'ⱄ', 't': 'ⱅ', 'u': 'ⱆ',
    'f': 'ⱇ', 'h': 'ⱈ', 'c': 'ⱌ', 'y': 'ⱏⰹ',
    'ě': 'ⱑ', 'ę': 'ⱗ', 'ǫ': 'ⱘ', 'ų': 'ⱘ',
    'č': 'ⱍ', 'š': 'ⱎ', 'ć': 'ⰼ', 'đ': 'ⰴⱐ',
    'ľ': 'ⰾⱐ', 'ĺ': 'ⰾⱐ', 'ť': 'ⱅⱐ', 'ď': 'ⰴⱐ', 'ň': 'ⱀⱐ', 'ń': 'ⱀⱐ',
    'ś': 'ⱄⱐ', 'ź': 'ⰸⱐ', 'ŕ': 'ⱃⱐ',
    'ȯ': 'ⱏ', 'ė': 'ⱐ', 'å': 'ⰰ̊',
  };

  const glagoliticUpper: Record<string, string> = {
    'A': 'Ⰰ', 'B': 'Ⰱ', 'V': 'Ⰲ', 'G': 'Ⰳ', 'D': 'Ⰴ',
    'E': 'Ⰵ', 'Ž': 'Ⰶ', 'Z': 'Ⰸ', 'I': 'Ⰹ', 'J': 'Ⰻ',
    'K': 'Ⰽ', 'L': 'Ⰾ', 'M': 'Ⰿ', 'N': 'Ⱀ', 'O': 'Ⱁ',
    'P': 'Ⱂ', 'R': 'Ⱃ', 'S': 'Ⱄ', 'T': 'Ⱅ', 'U': 'Ⱆ',
    'F': 'Ⱇ', 'H': 'Ⱈ', 'C': 'Ⱌ', 'Y': 'ⰟⰉ',
    'Ě': 'Ⱑ', 'Ę': 'Ⱗ', 'Ǫ': 'Ⱘ', 'Ų': 'Ⱘ',
    'Č': 'Ⱍ', 'Š': 'Ⱎ', 'Ć': 'Ⰼ', 'Đ': 'Ⰴⱐ',
    'Ľ': 'Ⰾⱐ', 'Ĺ': 'Ⰾⱐ', 'Ť': 'Ⱅⱐ', 'Ď': 'Ⰴⱐ', 'Ň': 'Ⱀⱐ', 'Ń': 'Ⱀⱐ',
    'Ś': 'Ⱄⱐ', 'Ź': 'Ⰸⱐ', 'Ŕ': 'Ⱃⱐ',
    'Ȯ': 'Ⱏ', 'Ė': 'Ⱐ', 'Å': 'Ⰰ̊',
  };

  let result = "";
  let i = 0;
  while (i < text.length) {
    const ch = text[i];
    const next = i + 1 < text.length ? text[i + 1] : "";
    const pair = ch + next;

    if (pair.toLowerCase() === "dž") {
      const gl = lower(ch) === ch ? "ⰴⰶ" : "ⰄⰆ";
      result += gl; i += 2; continue;
    }
    if (pair.toLowerCase() === "št") {
      const gl = lower(ch) === ch ? "ⱋ" : "Ⱋ";
      result += gl; i += 2; continue;
    }
    if (pair.toLowerCase() === "dz") {
      const gl = lower(ch) === ch ? "ⰷ" : "Ⰷ";
      result += gl; i += 2; continue;
    }

    if (pair.toLowerCase() === "ju") {
      const gl = lower(ch) === ch ? "ⱓ" : "Ⱓ";
      result += gl; i += 2; continue;
    }
    if (pair.toLowerCase() === "jo") {
      const gl = lower(ch) === ch ? "ⱖ" : "Ⱖ";
      result += gl; i += 2; continue;
    }
    if (pair.toLowerCase() === "je") {
      const gl = lower(ch) === ch ? "ⱔ" : "Ⱔ";
      result += gl; i += 2; continue;
    }
    if (pair.toLowerCase() === "ja") {
      const gl = lower(ch) === ch ? "ⰻⰰ" : "ⰉⰀ";
      result += gl; i += 2; continue;
    }

    const isUpper = ch === ch.toUpperCase();
    if (isUpper && glagoliticUpper[ch]) {
      result += glagoliticUpper[ch];
    } else if (glagoliticLower[ch]) {
      result += glagoliticLower[ch];
    } else {
      // Гласная с тоновым знаком вне таблицы: буква по таблице, знак сохраняется.
      const decomposed = ch.normalize("NFD");
      const base = decomposed.length > 1
        ? glagoliticUpper[decomposed[0]] ?? glagoliticLower[decomposed[0]]
        : undefined;
      result += base ? base + decomposed.slice(1) : ch;
    }
    i++;
  }

  return result;
};

export const standardToSimpleCyr = (text: string) => {
    if (!text) return "";

    // Шаг 0: Нормализация мягких согласных перед i, e, ę, ě
    const normalized = normalizeSoftConsonants(text);

    // Шаг 1: Сжатие этимологических окончаний прилагательных на границах слов (-yj/-ij -> -ы/-и)
    let processed = normalized
        .replace(/yj(?![▲\p{L}])/gu, 'ы')
        .replace(/ij(?![▲\p{L}])/gu, 'и')
        .replace(/YJ(?![▲\p{L}])/gu, 'Ы')
        .replace(/IJ(?![▲\p{L}])/gu, 'И');

    // Шаг 2: Замена сложных лигатур и диграфов (Dž, Št, Ks)
    processed = processed
        .replace(/Dž/g, 'Џ').replace(/dž/g, 'џ')
        .replace(/Št/g, 'Щ').replace(/št/g, 'щ')
        .replace(/Ks/g, 'Ќ').replace(/ks/g, 'ќ')
        .replace(/Ps/g, 'Ѱ').replace(/ps/g, 'ѱ');

    // Шаг 3: Перевод носовых гласных и ятя в упрощённые кириллические эквиваленты
    const fixedRules = {
        // Согласные (слева латиница, справа кириллица)
        'B': 'Б', 'b': 'б', 'V': 'В', 'v': 'в', 'G': 'Г', 'g': 'г',
        'D': 'Д', 'd': 'д', 'Ž': 'Ж', 'ž': 'ж', 'Z': 'З', 'z': 'з',
        'P': 'П', 'p': 'п', 'F': 'Ф', 'f': 'ф', 'H': 'Х', 'h': 'х',
        'K': 'К', 'k': 'к', 'T': 'Т', 't': 'т', 'Č': 'Ч', 'č': 'ч',
        'Š': 'Ш', 'š': 'ш', 'S': 'С', 's': 'с', 'C': 'Ц', 'c': 'ц',
        'L': 'Л', 'l': 'л', 'M': 'М', 'm': 'м', 'N': 'Н', 'n': 'н',
        'R': 'Р', 'r': 'р',

        // Базовые гласные
        'A': 'А', 'a': 'а', 'E': 'Е', 'e': 'е', 'I': 'И', 'i': 'и',
        'O': 'О', 'o': 'о', 'U': 'У', 'u': 'у', 'Y': 'Ы', 'y': 'ы',

        // --- Упрощение исторических графем ---
        'Ě': 'Е', 'ě': 'e', // Ять упрощается до Е/е
        'Ę': 'Е', 'ę': 'e', // Малый юс упрощается до Е/е
        'Ǫ': 'У', 'ǫ': 'у', // Большой юс (устар. написание o+огонек) упрощается до У/у
        'Ų': 'У', 'ų': 'у', // Большой юс (совр. написание u+огонек) упрощается до У/у
        'Å': 'А', 'å': 'а', 'Ė': 'Е', 'ė': 'е', 'Ȯ': 'О', 'ȯ': 'о', // долгое a и еры
        'Ŕ': 'Р', 'ŕ': 'р', 'Ĺ': 'Л', 'ĺ': 'л', 'Ń': 'Н', 'ń': 'н', // слоговые и мягкое n
    };

    const step3 = processed.split('').map(char => fixedRules.hasOwnProperty(char) ? fixedRules[char] : char).join('');

    // Шаг 4: Перевод латинского 'j/J' в кириллический йот 'і/І' с контролем окружения
    let result = "";

    for (let i = 0; i < step3.length; i++) {
        const char = step3[i];

        if (char === 'j' || char === 'J') {
            const prevChar = result.length > 0 ? result[result.length - 1].toLowerCase() : '';
            const nextChar = i < step3.length - 1 ? step3[i + 1].toLowerCase() : '';

            // Если после j идет гласная, которую нужно смягчить через і
            if (nextChar && ['а', 'у', 'е', 'о'].includes(nextChar)) {
                // Если перед j уже стоит кириллическая 'и', мы её поглощаем, чтобы не плодить сдвоенные "иіа"
                if (prevChar === 'и') {
                    continue;
                } else {
                    result += (char === 'J') ? 'І' : 'і';
                }
            } else {
                // Если это одиночный йот на конце корня (например, "краі")
                result += (char === 'J') ? 'І' : 'і';
            }
        } else {
            result += char;
        }
    }

    // Шаг 5: Пост-процессинг оставшихся мягких согласных (ć→ч, đ→д, остальные →ль/ть/дь/нь/сь/зь)
    result = result
        .replace(/Ľ/g, 'ЛЬ').replace(/ľ/g, 'ль')
        .replace(/Ť/g, 'ТЬ').replace(/ť/g, 'ть')
        .replace(/Ď/g, 'ДЬ').replace(/ď/g, 'дь')
        .replace(/Ň/g, 'НЬ').replace(/ň/g, 'нь')
        .replace(/Ś/g, 'СЬ').replace(/ś/g, 'сь')
        .replace(/Ź/g, 'ЗЬ').replace(/ź/g, 'зь')
        .replace(/Ć/g, 'Ч').replace(/ć/g, 'ч')
        .replace(/Đ/g, 'Д').replace(/đ/g, 'д');

    return result;
}


