import csv
import sqlite3
import os

import datetime

DB_PATH = os.path.join(os.path.dirname(__file__), '..', '..', 'interlex.db')
CSV_PATH = os.path.join(os.path.dirname(__file__), 'hsb_translated.csv')
BATCH_SIZE = 500
NOW = datetime.datetime.now(datetime.UTC).isoformat()

def import_hsb():
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()

    existing = cur.execute("SELECT COUNT(*) FROM hsb").fetchone()[0]
    if existing > 0:
        answer = input(f"hsb table already has {existing} rows. Delete and reimport? (y/N): ")
        if answer.lower() == 'y':
            cur.execute("DELETE FROM hsb")
            conn.commit()
            print("Cleared existing data.")
        else:
            print("Aborting.")
            conn.close()
            return

    with open(CSV_PATH, 'r', encoding='utf-8') as f:
        reader = csv.reader(f)
        rows = list(reader)

    total = len(rows)
    print(f"Total rows in CSV: {total}")

    inserted = 0
    batch = []

    for i, row in enumerate(rows, 1):
        meaning_id = int(row[0]) if row[0].strip() else None
        word_id = int(row[1]) if row[1].strip() else None
        value = row[2].strip() if len(row) > 2 and row[2].strip() else None

        batch.append((NOW, NOW, value, word_id, meaning_id))

        if len(batch) >= BATCH_SIZE:
            cur.executemany(
                "INSERT OR IGNORE INTO hsb (createdAt, updatedAt, value, wordId, meaningId) VALUES (?, ?, ?, ?, ?)",
                batch
            )
            conn.commit()
            inserted += len(batch)
            batch = []
            print(f"  Progress: {inserted}/{total}")

    if batch:
        cur.executemany(
            "INSERT OR IGNORE INTO hsb (createdAt, updatedAt, value, wordId, meaningId) VALUES (?, ?, ?, ?, ?)",
            batch
        )
        conn.commit()
        inserted += len(batch)

    conn.close()
    print(f"Done. Inserted {inserted} rows into hsb.")

if __name__ == "__main__":
    import_hsb()