import json
import re
import os
import fitz

def parse_pdf_to_json_structure(pdf_path: str) -> list[dict]:
    """Парсит PDF по печатному оглавлению с защитой от несуществующих страниц."""
    doc = fitz.open(pdf_path)
    total_pages = len(doc)  # Реальное количество страниц в файле

    toc_text = ""
    toc_page_index = -1

    # 1. Находим страницу с оглавлением
    for idx, page in enumerate(doc):
        text = page.get_text("text")
        if "obsah" in text.lower() or "sodrženje" in text.lower() or "содержание" in text.lower():
            toc_text = text
            toc_page_index = idx
            break

    if not toc_text:
        raise ValueError(
            "Не удалось найти страницу оглавления по ключевому слову 'Obsah'."
        )

    # 2. Вытаскиваем названия глав и начальные страницы
    matches = re.findall(r"([^\n\.]+)(?:\.|\s)+(\d+)\b", toc_text)

    chapters_info = []
    for title, page_num in matches:
        clean_title = " ".join(title.split())
        if clean_title.lower() in ["obsah", "sodrženje", "содержание"]:
            continue

        # Переводим в индекс (с 0), защищая от выхода за рамки документа
        start_page = int(page_num) - 1
        if start_page >= total_pages:
            print(
                f"Предупреждение: Глава '{clean_title}' ссылается на страницу {page_num}, "
                f"но в документе всего {total_pages} страниц. Пропускаем."
            )
            continue

        chapters_info.append({"title": clean_title, "start_page": start_page})

    if not chapters_info:
        raise ValueError(
            "Не удалось распознать структуру оглавления или все страницы вне диапазона файла."
        )

    result_json = []

    # 3. Сбор текста и разрезка на абзацы
    for i, current_chap in enumerate(chapters_info):
        title = current_chap["title"]
        start_page = current_chap["start_page"]

        # Находим страницу окончания текущей главы с учетом реального размера файла
        if i + 1 < len(chapters_info):
            end_page = min(chapters_info[i + 1]["start_page"], total_pages)
        else:
            end_page = total_pages

        # Если из-за обрезки файла начальная страница равна конечной, пропускаем шаг
        if start_page >= end_page:
            continue

        chapter_raw_text = ""
        for page_num in range(start_page, end_page):
            if page_num == toc_page_index:
                continue

            page_text = doc[page_num].get_text("text")
            if page_text.strip():
                chapter_raw_text += page_text + "\n\n"

        # 4. Разбиение текста на абзацы
        raw_paragraphs = re.split(r"\n\s*\n", chapter_raw_text)

        cleaned_paragraphs = []
        for p in raw_paragraphs:
            clean_p = " ".join(p.split())
            if clean_p:
                cleaned_paragraphs.append(clean_p)

        result_json.append({"title": title, "paragraphs": cleaned_paragraphs})

    return result_json


# --- Пример использования и сохранения в .json файл ---
if __name__ == "__main__":
    current_dir = os.path.dirname(os.path.abspath(__file__))
    pdf_file = os.path.join(current_dir, "pdf", "maly_princ_lat.pdf")

    try:
        # Получаем структуру в виде Python-списка с диктами
        parsed_data = parse_pdf_to_json_structure(pdf_file)

        # Превращаем в валидную JSON-строку с поддержкой Юникода (кириллицы/латиницы)
        json_output = json.dumps(parsed_data, ensure_ascii=False, indent=4)

        # Сохраняем результат в файл
        with open("output_structure.json", "w", encoding="utf-8") as f:
            f.write(json_output)

        print(
            "Парсинг успешно завершен! Результат сохранен в 'output_structure.json'"
        )

        # Пример того, как структура выглядит внутри Python:
        # print(parsed_data[0]["title"])          # Выведет название 1-й главы
        # print(parsed_data[0]["paragraphs"][0])   # Выведет 1-й абзац 1-й главы

    except Exception as e:
        print(f"Ошибка: {e}")
