export const isvToCyr = (text: string) => {
    if (!text) return "";

    // Шаг 1: Замена лигатур и диграфов (Dž, Št, Ks)
    const processed = text
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
        'H': 'Х', 'h': 'х', // Исправлено 'h'
        'K': 'К', 'k': 'к', // Исправлено 'k'
        'T': 'Т', 't': 'т', // Исправлено 't' (теперь слово tělo обработается верно)
        'Č': 'Ч', 'č': 'ч',
        'Š': 'Ш', 'š': 'ш',
        'S': 'С', 's': 'с', // Исправлено 's'
        'C': 'Ц', 'c': 'ц', // Исправлено 'c'
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
        'Ě': 'Ѣ', 'ě': 'ѣ', // Ять
        'Ę': 'Ѧ', 'ę': 'ѧ', // Малый юс
        'Ǫ': 'Ѫ', 'ǫ': 'ѫ', // Большой юс
    };

    let result = "";

    // Шаг 3: Посимвольная сборка текста
    for (let i = 0; i < processed.length; i++) {
        let char = processed[i];

        if (rules.hasOwnProperty(char)) {
            result += rules[char];
        } else {
            result += char;
        }
    }

    // Возвращаем полностью готовую кириллицу новословницы
    return result;
}

export const isvToTranscription = (etymologicalWord: string) => {
    if (!etymologicalWord) return "[]";

    // Приводим к нижнему регистру для упрощения разбора
    let str = etymologicalWord.toLowerCase().trim();

    // 1. Предварительная замена сложных аффрикат и лигатур
    str = str
        .replace(/dž/g, 'd͡ʒ')  // аффриката џ
        .replace(/št/g, 'ʃt')  // лигатура щ
        .replace(/č/g, 't͡ʃ')   // ч
        .replace(/c/g, 't͡s');   // ц

    // 2. Обработка простых шипящих
    str = str
        .replace(/ž/g, 'ʒ')
        .replace(/š/g, 'ʃ')
        .replace(/h/g, 'x'); // х передается как велярный [x]

    // 3. Контекстная обработка 'j' (Смягчение согласных vs Звук [j])
    let ipaChars = [];
    const vowels = ['a', 'e', 'ě', 'i', 'y', 'o', 'u', 'ę', 'ǫ'];

    for (let i = 0; i < str.length; i++) {
        let char = str[i];

        if (char === 'j') {
            let prevChar = i > 0 ? str[i - 1] : '';
            let nextChar = i < str.length - 1 ? str[i + 1] : '';

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
            } else if (char === 'ǫ') {
                ipaChars.push('ɔ̃'); // Носовой большой юс
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

    // Шаг 1: Сжатие этимологических окончаний прилагательных на границах слов (-yj/-ij -> -y/-i)
    let processed = text
        .replace(/yj(?![▲\p{L}])/gu, 'y')
        .replace(/ij(?![▲\p{L}])/gu, 'i')
        .replace(/YJ(?![▲\p{L}])/gu, 'Y')
        .replace(/IJ(?![▲\p{L}])/gu, 'I');

    // Шаг 2: Перевод носовых гласных и ятя в упрощенный вид
    const fixedRules = {
        'Ě': 'E', 'ě': 'e', // Ять -> E
        'Ę': 'E', 'ę': 'e', // Малый юс -> E
        'Ǫ': 'U', 'ǫ': 'u', // Большой юс -> U
    };

    let step2 = processed.split('').map(char => fixedRules.hasOwnProperty(char) ? fixedRules[char] : char).join('');

    // Шаг 3: Перевод сочетаний с 'j' в формат 'i' + твёрдая гласная (согласно правилу первой функции)
    // Исключение: если перед 'j' уже стоит 'i', то 'j' просто поглощается (чтобы не было триплексов 'iia')
    let result = "";

    for (let i = 0; i < step2.length; i++) {
        let char = step2[i];

        if (char === 'j' || char === 'J') {
            let prevChar = result.length > 0 ? result[result.length - 1].toLowerCase() : '';
            let nextChar = i < step2.length - 1 ? step2[i + 1].toLowerCase() : '';
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

    return result;
}

export const isvToGlagolitic = (text: string): string => {
  if (!text) return "";

  const lower = (ch: string) => ch.toLowerCase();

  const glagoliticLower: Record<string, string> = {
    'a': 'ⰰ', 'b': 'ⰱ', 'v': 'ⰲ', 'g': 'ⰳ', 'd': 'ⰴ',
    'e': 'ⰵ', 'ž': 'ⰶ', 'z': 'ⰸ', 'i': 'ⰹ', 'j': 'ⰻ',
    'k': 'ⰽ', 'l': 'ⰾ', 'm': 'ⰿ', 'n': 'ⱀ', 'o': 'ⱁ',
    'p': 'ⱂ', 'r': 'ⱃ', 's': 'ⱄ', 't': 'ⱅ', 'u': 'ⱆ',
    'f': 'ⱇ', 'h': 'ⱈ', 'c': 'ⱌ', 'y': 'ⱏⰹ',
    'ě': 'ⱑ', 'ę': 'ⱗ', 'ǫ': 'ⱘ',
  };

  const glagoliticUpper: Record<string, string> = {
    'A': 'Ⰰ', 'B': 'Ⰱ', 'V': 'Ⰲ', 'G': 'Ⰳ', 'D': 'Ⰴ',
    'E': 'Ⰵ', 'Ž': 'Ⰶ', 'Z': 'Ⰸ', 'I': 'Ⰹ', 'J': 'Ⰻ',
    'K': 'Ⰽ', 'L': 'Ⰾ', 'M': 'Ⰿ', 'N': 'Ⱀ', 'O': 'Ⱁ',
    'P': 'Ⱂ', 'R': 'Ⱃ', 'S': 'Ⱄ', 'T': 'Ⱅ', 'U': 'Ⱆ',
    'F': 'Ⱇ', 'H': 'Ⱈ', 'C': 'Ⱌ', 'Y': 'ⰟⰉ',
    'Ě': 'Ⱑ', 'Ę': 'Ⱗ', 'Ǫ': 'Ⱘ',
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
      result += ch;
    }
    i++;
  }

  return result;
};

export const standardToSimpleCyr = (text: string) => {
    if (!text) return "";

    // Шаг 1: Сжатие этимологических окончаний прилагательных на границах слов (-yj/-ij -> -ы/-и)
    let processed = text
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
        'Ǫ': 'У', 'ǫ': 'у', // Большой юс упрощается до У/у
    };

    let step3 = processed.split('').map(char => fixedRules.hasOwnProperty(char) ? fixedRules[char] : char).join('');

    // Шаг 4: Перевод латинского 'j/J' в кириллический йот 'і/І' с контролем окружения
    let result = "";

    for (let i = 0; i < step3.length; i++) {
        let char = step3[i];

        if (char === 'j' || char === 'J') {
            let prevChar = result.length > 0 ? result[result.length - 1].toLowerCase() : '';
            let nextChar = i < step3.length - 1 ? step3[i + 1].toLowerCase() : '';

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

    return result;
}


