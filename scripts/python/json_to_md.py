import json
import os
import sys


def json_to_markdown(json_path: str, output_path: str | None = None) -> str:
    with open(json_path, encoding="utf-8") as f:
        data = json.load(f)

    parts = []
    for chapter in data:
        parts.append(f"# {chapter['title']}")
        parts.append("")
        for p in chapter["paragraphs"]:
            parts.append(p)
            parts.append("")

    md = "\n".join(parts).strip()

    if output_path:
        with open(output_path, "w", encoding="utf-8") as f:
            f.write(md)

    return md


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Использование: python json_to_md.py <input.json> [output.md]")
        sys.exit(1)

    json_path = sys.argv[1]
    output_path = sys.argv[2] if len(sys.argv) > 2 else None

    if not output_path:
        base, _ = os.path.splitext(json_path)
        output_path = base + ".md"

    json_to_markdown(json_path, output_path)
    print(f"Готово! Сохранено в {output_path}")