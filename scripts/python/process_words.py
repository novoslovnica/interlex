import json
import os
from ruwordnet import RuWordNet

# Инициализируем тезаурус (при первом запуске скачаются файлы базы данных)
wn = RuWordNet()

INPUT_FILE = "words.json"
OUTPUT_FILE = "words_enriched.json"

def get_related_words(synset_list, current_word):
    """
    Вспомогательная функция для сбора слов из связанных синсетов.

    :param synset_list: Список связанных синсетов (например, synset.hypernyms)
    :param current_word: Текущее слово (слово-оригинал), чтобы исключить его из результатов
    :return: Список (list) уникальных слов в нижнем регистре
    """
    words = set()  # Используем множество, чтобы избежать дубликатов слов

    # 1. Перебираем каждый связанный синсет в полученном списке
    for rel_synset in synset_list:

        # 2. Внутри каждого синсета перебираем входящие в него слова (senses)
        for sense in rel_synset.senses:
            name = sense.name.lower()  # Приводим к нижнему регистру

            # 3. Добавляем слово, только если оно не совпадает с исходным словом
            if name != current_word:
                words.add(name)

    # 4. Возвращаем обычный список, так как set() нельзя напрямую записать в JSON
    return list(words)

def get_synonyms_and_antonyms(word: str):
    """Ищет синонимы и антонимы для слова в RuWordNet."""
    if not word or not isinstance(word, str):
        return [], [], []

    word_clean = word.strip().lower()

    try:
        senses = wn[word_clean]
    except KeyError:
        return [], [], []

    synonyms = set()
    antonyms = set()

    for sense in senses:
        synset = sense.synset

        synset_data = {
            "synsetId": synset.id,
            "partOfSpeech": synset.part_of_speech,
            "definition": synset.definition,
            # Базовые связи (доступны для всех частей речи)
            "hypernyms": get_related_words(synset.hypernyms, word_clean),
            "hyponyms": get_related_words(synset.hyponyms, word_clean),
            "meronyms": get_related_words(synset.meronyms, word_clean),
            "holonyms": get_related_words(synset.holonyms, word_clean),
            "related": get_related_words(synset.related, word_clean)
        }

        # Добавляем глагольные связи только если это глагол
        if synset.part_of_speech == 'V':
            synset_data.update({
                "premises": get_related_words(synset.premises, word_clean),
                "conclusions": get_related_words(synset.conclusions, word_clean),
                "causes": get_related_words(synset.causes, word_clean),
                "effects": get_related_words(synset.effects, word_clean)
            })

        # Если у вас есть вытащенные домены (как в вашем примере)
        if hasattr(synset, 'domains') and synset.domains:
            synset_data["domains"] = ", ".join([d.name for d in synset.domains])

        for syn_sense in synset.senses:
            syn_name = syn_sense.name.lower()
            if syn_name != word_clean:
                synonyms.add(syn_name)

        for antonym_synset in synset.antonyms:
            for ant_sense in antonym_synset.senses:
                antonyms.add(ant_sense.name.lower())

    return list(synonyms), list(antonyms), senses, synset_data


def get_synsets_for_word(senses):
    """Извлекает синсеты из списка RuWordNet senses."""
    synsets_data = []
    seen = set()

    for sense in senses:
        synset = sense.synset
        sid = synset.id
        if sid in seen:
            continue
        seen.add(sid)

        entry = {
            "synsetId": sid,
            "partOfSpeech": synset.part_of_speech,
            "definition": synset.definition,
        }

        ili_list = getattr(synset, "ili", []) or []
        if ili_list:
            entry["synsetExternalId"] = ili_list[0].id

        domains_list = getattr(synset, "domains", []) or []
        if domains_list:
            entry["domains"] = ",".join(
                d.title for d in domains_list if hasattr(d, "title") and d.title
            )

        synsets_data.append(entry)

    return synsets_data

def main():
    if not os.path.exists(INPUT_FILE):
        print(f"Ошибка: Файл '{INPUT_FILE}' не найден в текущей директории.")
        return

    print(f"Читаем данные из {INPUT_FILE}...")
    with open(INPUT_FILE, "r", encoding="utf-8") as f:
        try:
            data = json.load(f)
        except json.JSONDecodeError:
            print("Ошибка: Неверный формат JSON в исходном файле.")
            return

    if not isinstance(data, list):
        print("Ошибка: Исходный JSON должен содержать массив объектов [{}, {}, ...]")
        return

    total_words = len(data)
    print(f"Успешно загружено объектов: {total_words}. Начинаем обработку...")

    for index, item in enumerate(data, 1):
        word_value = item.get("translation", "")

        synonyms, antonyms, senses, synset_data = get_synonyms_and_antonyms(word_value)

        item["synonyms"] = synonyms
        item["antonyms"] = antonyms
        item["synsets"] = get_synsets_for_word(senses)
        item["synset_data"] = synset_data

        if index % 2000 == 0 or index == total_words:
            print(f"Обработано объектов: {index}/{total_words}")

    print(f"Сохраняем результат в {OUTPUT_FILE}...")
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    print("Готово! Процесс успешно завершен.")

if __name__ == "__main__":
    main()
