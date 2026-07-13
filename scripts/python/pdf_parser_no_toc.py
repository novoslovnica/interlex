import json
import re
import os
import sys
import fitz


def is_junk_line(line: str) -> bool:
    s = line.strip()
    if not s:
        return True
    if re.fullmatch(r"\d+", s):
        return True
    if re.match(r"^\(c\)", s, re.IGNORECASE):
        return True
    return False


def prev_line_ends_sentence(prev_line: str) -> bool:
    """Предыдущая строка заканчивается на . ! ? » — значит, это конец предложения."""
    s = prev_line.strip()
    if not s:
        return True
    if s[-1] in ".!?»\"":
        return True
    return False


def parse_book_simple(pdf_path: str) -> list[dict]:
    doc = fitz.open(pdf_path)
    all_paragraphs = []
    title = None

    for page_num in range(len(doc)):
        page_text = doc[page_num].get_text("text")
        lines = page_text.split("\n")

        if title is None:
            for line in lines:
                if not is_junk_line(line):
                    title = line.strip()
                    break

        if page_num == 0:
            continue

        for i, line in enumerate(lines):
            if is_junk_line(line):
                continue

            prev_line = lines[i - 1] if i > 0 else ""
            ended = prev_line_ends_sentence(prev_line)

            if ended and starts_with_upper(line):
                all_paragraphs.append(line.strip())
            else:
                if all_paragraphs:
                    all_paragraphs[-1] += " " + line.strip()
                else:
                    all_paragraphs.append(line.strip())

    all_paragraphs = [re.sub(r"\s+", " ", p).strip() for p in all_paragraphs]
    all_paragraphs = [p for p in all_paragraphs if p]

    if title is None:
        title = "Весь текст"

    return [{"title": title, "paragraphs": all_paragraphs}]


def starts_with_upper(line: str) -> bool:
    s = line.strip()
    if not s:
        return False
    c = s[0]
    if c.islower():
        return False
    return True


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Использование: python pdf_parser_no_toc.py <путь_к_pdf> [выходной_json]")
        sys.exit(1)

    pdf_file = sys.argv[1]
    if not os.path.isfile(pdf_file):
        print(f"Файл не найден: {pdf_file}")
        sys.exit(1)

    output_file = sys.argv[2] if len(sys.argv) > 2 else "output_no_toc.json"

    try:
        parsed_data = parse_book_simple(pdf_file)
        json_output = json.dumps(parsed_data, ensure_ascii=False, indent=4)

        with open(output_file, "w", encoding="utf-8") as f:
            f.write(json_output)

        print(f"Готово! Сохранено в {output_file}")
        print(f"Заголовок: {parsed_data[0]['title']}")
        print(f"Абзацев: {len(parsed_data[0]['paragraphs'])}")
        for i, p in enumerate(parsed_data[0]["paragraphs"][:8]):
            print(f"  [{i}] {p[:120]}...")

    except Exception as e:
        print(f"Ошибка: {e}")
        sys.exit(1)