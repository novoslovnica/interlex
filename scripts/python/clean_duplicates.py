import sqlite3
import os

DB_PATH = os.path.join(os.path.dirname(__file__), '..', '..', 'interlex.db')

def clean_duplicates(table: str):
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()

    total = cur.execute(f"SELECT COUNT(*) FROM {table}").fetchone()[0]
    dups = cur.execute(
        f"SELECT COUNT(*) - COUNT(DISTINCT meaningId || '-' || COALESCE(value, '')) FROM {table}"
    ).fetchone()[0]
    print(f"{table}: {total} total rows, ~{dups} duplicates to remove")

    cur.execute("PRAGMA journal_mode=WAL")

    batch_size = 500
    deleted = 0

    while True:
        cur.execute(f"""
            DELETE FROM {table}
            WHERE id IN (
                SELECT id FROM (
                    SELECT id, ROW_NUMBER() OVER (
                        PARTITION BY meaningId, value
                        ORDER BY id
                    ) AS rn
                    FROM {table}
                    WHERE meaningId IS NOT NULL
                ) ranked
                WHERE rn > 1
                LIMIT ?
            )
        """, (batch_size,))
        conn.commit()
        rowcount = cur.rowcount
        if rowcount == 0:
            break
        deleted += rowcount
        print(f"  Deleted {deleted}...")

    conn.close()
    print(f"{table}: removed {deleted} duplicate rows")

if __name__ == "__main__":
    clean_duplicates("dsb")
    clean_duplicates("hsb")