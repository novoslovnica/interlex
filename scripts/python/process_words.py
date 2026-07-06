import json
import os
# Импортируем из правильного пакета 'ruwordnet'
from ruwordnet import RuWordNet

# Инициализируем тезаурус (при первом запуске скачаются файлы базы данных)
wn = RuWordNet()

INPUT_FILE = "words.json"
OUTPUT_FILE = "words_enriched.json"

def get_synonyms_and_antonyms(word: str):
    """Ищет синонимы и антонимы для слова в RuWordNet."""
    if not word or not isinstance(word, str):
        return [], []

    word_clean = word.strip().lower()

    try:
        senses = wn[word_clean]
    except KeyError:
        return [], []

    synonyms = set()
    antonyms = set()

    for sense in senses:
        synset = sense.synset

        # ИСПРАВЛЕНО: синонимы достаем через synset.senses
        for syn_sense in synset.senses:
            syn_name = syn_sense.name.lower()
            if syn_name != word_clean:
                synonyms.add(syn_name)

        # ИСПРАВЛЕНО: антонимы собираем тоже через .senses противоположных синсетов
        for antonym_synset in synset.antonyms:
            for ant_sense in antonym_synset.senses:
                antonyms.add(ant_sense.name.lower())

    return list(synonyms), list(antonyms)

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

        synonyms, antonyms = get_synonyms_and_antonyms(word_value)

        item["synonyms"] = synonyms
        item["antonyms"] = antonyms

        if index % 2000 == 0 or index == total_words:
            print(f"Обработано объектов: {index}/{total_words}")

    print(f"Сохраняем результат в {OUTPUT_FILE}...")
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    print("Готово! Процесс успешно завершен.")

if __name__ == "__main__":
    main()
