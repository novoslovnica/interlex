import os
import csv
import time
import random
import translators as ts

# --- НАСТРОЙКИ ---
INPUT_FILE = "en_translations.csv"
OUTPUT_FILE = "translated.csv"
BATCH_SIZE = 20  # Безопасный размер для исключения багов разметки
# ------------------

def load_progress():
    """Считает количество строк в итоговом файле."""
    if not os.path.exists(OUTPUT_FILE):
        return 0
    with open(OUTPUT_FILE, "r", encoding="utf-8") as f:
        reader = csv.reader(f)
        return sum(1 for row in reader if row)

def safe_translate_batch(texts_to_translate):
    """
    Переводит пачку чистых текстовых строк через Bing.
    """
    delimiter = "\n---\n"
    merged_text = delimiter.join(texts_to_translate)

    attempt = 1
    while True:
        try:
            translated_merged = ts.translate_text(
                merged_text,
                from_language='de',
                to_language='dsb',
                translator='bing'
            )

            # Разделяем обратно по маркеру
            translated_lines = translated_merged.split("---")
            translated_lines = [line.strip() for line in translated_lines if line.strip() != ""]

            # Резервный сплит по переносу строки, если маркер пропал
            if len(translated_lines) != len(texts_to_translate):
                translated_lines = [line.strip() for line in translated_merged.split("\n") if line.strip() != ""]

            # Если всё совпало по количеству элементов — возвращаем результат
            if len(translated_lines) == len(texts_to_translate):
                return translated_lines

            # Если размеры не совпали — мгновенно уходим в построчный режим
            print(f"\n[!] Рассинхронизация разметки (ушло {len(texts_to_translate)}, пришло {len(translated_lines)}).")
            print("Мгновенно переключаемся на безопасный построчный режим для этой пачки...")
            return fallback_line_by_line(texts_to_translate)

        except Exception as e:
            if "Рассинхронизация" in str(e):
                return fallback_line_by_line(texts_to_translate)

            wait_time = 30 if attempt == 1 else (60 if attempt == 2 else 180)
            print(f"\n[!] Ошибка сети Bing (Попытка {attempt}). Ошибка: {e}")
            print(f"Ждем {wait_time} секунд для сброса лимитов...")
            time.sleep(wait_time)
            attempt += 1

def fallback_line_by_line(texts_to_translate):
    """Аварийный построчный режим для списка чистых текстов."""
    translated_results = []
    for text_item in texts_to_translate:
        success = False
        while not success:
            try:
                res = ts.translate_text(text_item, from_language='de', to_language='dsb', translator='bing')
                translated_results.append(res.strip())
                success = True
            except:
                print(f"    [!] Ошибка строки через Bing. Спим 30 сек...")
                time.sleep(30)

        time.sleep(random.uniform(2.0, 4.0))
    return translated_results

def main():
    if not os.path.exists(INPUT_FILE):
        print(f"Ошибка: Файл {INPUT_FILE} не найден!")
        return

    with open(INPUT_FILE, "r", encoding="utf-8") as f:
        reader = csv.reader(f)
        # Читаем CSV в структуру списков: [id1, id2, text]
        all_rows = [row for row in reader if len(row) >= 3]

    total_lines = len(all_rows)
    print(f"Всего строк в исходном файле: {total_lines}")

    already_translated = load_progress()
    if already_translated > 0:
        print(f"Найдена прошлая сессия. Пропускаем первые {already_translated} строк.")

    with open(OUTPUT_FILE, "a", encoding="utf-8", newline="") as out_f:
        writer = csv.writer(out_f)

        for i in range(already_translated, total_lines, BATCH_SIZE):
            batch_rows = all_rows[i:i + BATCH_SIZE]

            # Списки для разделения логики
            active_rows = []       # Сюда сохраняем полные строки [id1, id2, text] для перевода
            texts_to_translate = [] # Сюда сохраняем только чистый текст (третью колонку)

            for row in batch_rows:
                # Извлекаем текст из третьей колонки (индекс 2)
                raw_text = row[2]
                clean_text = raw_text.strip().replace('"', '')

                if clean_text:
                    active_rows.append(row)
                    texts_to_translate.append(raw_text)
                else:
                    # Если строка пустая (типа "",), сразу пишем её структуру в файл без перевода
                    writer.writerow([row[0], row[1], ""])

            # Если в этой пачке вообще нечего было переводить, просто сбрасываем буфер и идем дальше
            if not texts_to_translate:
                out_f.flush()
                continue

            print(f"Обработка: строки с {i} по {i + len(batch_rows)} (в обработке {len(texts_to_translate)} шт)...")

            # Передаем в переводчик строго список ЧИСТЫХ текстов (строк)
            translated_lines = safe_translate_batch(texts_to_translate)

            # Записываем результаты, четко сопоставляя оригинальные ID с полученными переводами
            if len(active_rows) == len(translated_lines):
                for original_row, translated_text in zip(active_rows, translated_lines):
                    writer.writerow([original_row[0], original_row[1], translated_text])
            else:
                # Аварийная защита структуры данных
                for original_row in active_rows:
                    writer.writerow([original_row[0], original_row[1], original_row[2]])

            out_f.flush()
            time.sleep(random.uniform(3.0, 5.5))

    print(f"\nУспешно завершено! Результат сохранен в {OUTPUT_FILE}")

if __name__ == "__main__":
    main()
