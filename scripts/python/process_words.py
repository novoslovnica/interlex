import json
import os
from ruwordnet import RuWordNet

# Инициализируем тезаурус (при первом запуске скачаются файлы базы данных)
wn = RuWordNet()

INPUT_FILE = "words.json"
OUTPUT_FILE = "words_enriched.json"

# Ё/е — частый источник промаха точного матчинга в русских корпусах (не
# полная морфология, просто устоявшаяся орфографическая нормализация).
def yo_variants(word: str):
    variants = {word}
    if "ё" in word:
        variants.add(word.replace("ё", "е"))
    if "е" in word:
        variants.add(word.replace("е", "ё"))
    return variants


def get_related_words(synset_list, current_word):
    """
    Вспомогательная функция для сбора слов из связанных синсетов.

    :param synset_list: Список связанных синсетов (например, synset.hypernyms)
    :param current_word: Текущее слово (слово-оригинал), чтобы исключить его из результатов
    :return: Список (list) уникальных слов в нижнем регистре
    """
    words = set()

    for rel_synset in synset_list:
        for sense in rel_synset.senses:
            name = sense.name.lower()
            if name != current_word:
                words.add(name)

    return list(words)


def get_related_senses(sense_list, current_word):
    """
    Как get_related_words, но принимает список Sense (не Synset) —
    нужно для derivation_relation, которое в пакете ruwordnet связано на
    уровне Sense, а не Synset (асимметрия API, см. AGENTS.md).
    """
    words = set()
    for sense in sense_list:
        name = sense.name.lower()
        if name != current_word:
            words.add(name)
    return list(words)


def get_ili_enrichment(synset):
    """Английский гросс/леммы через Princeton WordNet, если есть ILI-связь."""
    ili_list = getattr(synset, "ili", []) or []
    if not ili_list:
        return None
    wn_synset = ili_list[0]
    return {
        "definition": wn_synset.definition,
        "lemmas": [s.name for s in wn_synset.senses],
    }


def get_synonyms_and_antonyms(word: str):
    """Ищет синонимы, антонимы и связи для слова в RuWordNet."""
    if not word or not isinstance(word, str):
        return [], [], [], []

    word_clean = word.strip().lower()

    senses = None
    for candidate in yo_variants(word_clean):
        try:
            senses = wn[candidate]
            break
        except KeyError:
            continue
    if senses is None:
        return [], [], [], []

    # wn[...] возвращает либо один Sense, либо список Sense — приводим к списку
    if not isinstance(senses, list):
        senses = [senses]

    synonyms = set()
    antonyms = set()
    # Bug A fix (2026-07-23): раньше synset_data перезаписывался на каждой
    # итерации — если слово матчилось на несколько синсетов, сохранялись
    # только отношения последнего. Теперь аккумулируем в список, один
    # элемент на синсет.
    synset_data_list = []

    for sense in senses:
        synset = sense.synset

        entry = {
            "synsetId": synset.id,
            "partOfSpeech": synset.part_of_speech,
            "definition": synset.definition,
            # Базовые связи (доступны для всех частей речи)
            "hypernyms": get_related_words(synset.hypernyms, word_clean),
            "hyponyms": get_related_words(synset.hyponyms, word_clean),
            "meronyms": get_related_words(synset.meronyms, word_clean),
            "holonyms": get_related_words(synset.holonyms, word_clean),
            # related/pos_synonyms в пакете ruwordnet хранятся как две
            # "зеркальные" половины одного и того же симметричного отношения
            # (см. комментарий в models.py: "easier than dirty SQLAlchemy
            # hacks") — исходный скрипт брал только synset.related и терял
            # примерно половину связей, попавших в reverse-индекс. То же
            # верно для synset.antonyms ниже.
            "related": get_related_words(synset.related + synset.related_reverse, word_clean),
            "posSynonyms": get_related_words(synset.pos_synonyms + synset.pos_synonyms_reverse, word_clean),
            # Новое: instance-of (не то же самое, что hypernym/is-a)
            "instanceOfClasses": get_related_words(synset.classes, word_clean),
            "hasInstances": get_related_words(synset.instances, word_clean),
        }

        # Деривация — на уровне Sense, не Synset (см. AGENTS.md)
        entry["derivationTargets"] = get_related_senses(sense.derivations, word_clean)
        entry["derivationSources"] = get_related_senses(sense.sources, word_clean)

        # Добавляем глагольные связи только если это глагол
        if synset.part_of_speech == "V":
            entry.update({
                "premises": get_related_words(synset.premises, word_clean),
                "conclusions": get_related_words(synset.conclusions, word_clean),
                "causes": get_related_words(synset.causes, word_clean),
                "effects": get_related_words(synset.effects, word_clean),
            })

        if hasattr(synset, "domains") and synset.domains:
            entry["domains"] = ", ".join([d.title for d in synset.domains])

        ili_enrichment = get_ili_enrichment(synset)
        if ili_enrichment:
            entry["ili"] = ili_enrichment

        synset_data_list.append(entry)

        for syn_sense in synset.senses:
            syn_name = syn_sense.name.lower()
            if syn_name != word_clean:
                synonyms.add(syn_name)

        # antonyms + antonyms_reverse — тот же fix, что и для related выше
        for antonym_synset in synset.antonyms + synset.antonyms_reverse:
            for ant_sense in antonym_synset.senses:
                antonyms.add(ant_sense.name.lower())

    return list(synonyms), list(antonyms), senses, synset_data_list


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
        print(word_value)

        synonyms, antonyms, senses, synset_data_list = get_synonyms_and_antonyms(word_value)

        item["synonyms"] = synonyms
        item["antonyms"] = antonyms
        item["synsets"] = get_synsets_for_word(senses)
        item["synset_data_list"] = synset_data_list

        if index % 2000 == 0 or index == total_words:
            print(f"Обработано объектов: {index}/{total_words}")

    print(f"Сохраняем результат в {OUTPUT_FILE}...")
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    print("Готово! Процесс успешно завершен.")


if __name__ == "__main__":
    main()
