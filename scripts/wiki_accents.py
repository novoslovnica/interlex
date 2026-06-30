import xml.etree.ElementTree as ET
import bz2
import re
import csv
import os

# Пути к файлам (автоматическое раскрытие тильды для macOS)
dump_path = os.path.expanduser("~/Downloads/enwiktionary-latest-pages-articles.xml.bz2")
output_csv = "proto_slavic_accents.csv"

# Регулярное выражение для поиска категорий акцентных парадигмах внизу статьи
# Ловит строки вида: [[Category:Proto-Slavic nominals with accent paradigm a]]
category_pattern = re.compile(r"Proto-Slavic (?:nominals|verbs) with accent paradigm\s+([abc])", re.IGNORECASE)

def parse_wiktionary_dump(file_path, csv_path):
    print("Запуск финального парсинга по всему файлу... Пожалуйста, подождите.")

    with open(csv_path, mode="w", encoding="utf-8", newline="") as csv_file:
        writer = csv.writer(csv_file)
        writer.writerow(["Lemma", "Accent_Paradigm"])

        count = 0

        with bz2.open(file_path, "rt", encoding="utf-8") as f:
            context = ET.iterparse(f, events=("start", "end"))
            event, root = next(context)

            title = ""
            for event, elem in context:
                if event == "end":
                    tag = elem.tag.split("}")[-1]

                    if tag == "title":
                        title = elem.text if elem.text else ""

                    # Проверяем, что это строго страница праславянской реконструкции
                    elif tag == "text" and title.startswith("Reconstruction:Proto-Slavic/"):
                        text_content = elem.text if elem.text else ""

                        # Выделяем чистую лемму (убираем префикс)
                        lemma = title.replace("Reconstruction:Proto-Slavic/", "")

                        # Ищем категорию акцентной парадигмы в тексте
                        match = category_pattern.search(text_content)

                        if match:
                            accent_paradigm = match.group(1).upper()
                            writer.writerow([lemma, accent_paradigm])
                            count += 1
                            if count % 50 == 0:
                                print(f"Найдено лемм: {count}")

                    # Освобождаем память
                    elem.clear()

            root.clear()

    print(f"\nГотово! Успешно сохранено {count} лемм в файл {csv_path}")

if __name__ == "__main__":
    if not os.path.exists(dump_path):
        print(f"Ошибка: Файл не найден по пути: {dump_path}")
    else:
        parse_wiktionary_dump(dump_path, output_csv)
