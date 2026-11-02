import json
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path

from app import APP_DIR, get_database


def main():
    path = APP_DIR / "seed_drives.json"
    seed_drives = json.loads(path.read_text(encoding="utf-8"))
    connection = get_database()
    inserted = 0
    try:
        with connection:
            for drive in seed_drives:
                exists = connection.execute(
                    "SELECT 1 FROM placement_drives WHERE company = ? AND role = ? AND is_sample = 1",
                    (drive["company"], drive["role"]),
                ).fetchone()
                if exists:
                    continue
                date = (
                    datetime.now(timezone.utc).date()
                    + timedelta(days=drive["days_from_today"])
                ).isoformat()
                connection.execute(
                    """
                    INSERT INTO placement_drives
                        (id, company, role, eligibility, package_lpa, date, mode, type,
                         required_skills_json, apply_url, is_sample, created_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
                    """,
                    (
                        str(uuid.uuid4()), drive["company"], drive["role"],
                        drive["eligibility"], drive["package_lpa"], date,
                        drive["mode"], drive["type"],
                        json.dumps(drive["required_skills"]), drive["apply_url"],
                        datetime.now(timezone.utc).isoformat(),
                    ),
                )
                inserted += 1
    finally:
        connection.close()
    print(f"Seeded {inserted} sample placement drives.")
    print("Market data and certification recommendations are read from their editable JSON catalogs.")
    print("No demo login is created; users authenticate through the configured Firebase project.")


if __name__ == "__main__":
    main()
