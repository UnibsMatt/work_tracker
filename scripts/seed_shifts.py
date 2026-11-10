#!/usr/bin/env python3
"""Add past shifts to the database.

Every shift starts at START (08:00, Italian time) and lasts the given hours.
Days that already have a shift are skipped, so it is safe to run it again.
A backup of the database is made before writing.

    python3 scripts/seed_shifts.py            # write
    python3 scripts/seed_shifts.py --dry-run  # only show what would be added
    python3 scripts/seed_shifts.py --db path/to/shifts.db

To add more days, extend SHIFTS below: (year, month) -> {day: hours}.
"""
import argparse
import os
import shutil
import sqlite3
import sys
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

TZ = ZoneInfo(os.environ.get('TZ') or 'Europe/Rome')
START = (8, 0)  # 08:00

SHIFTS = {
    (2026, 10): {
        1: 7, 2: 7, 3: 6, 4: 7.5, 5: 7, 6: 7, 7: 7, 8: 7,
        11: 6, 12: 7, 13: 7, 14: 7, 15: 7, 17: 6, 18: 8, 19: 7,
        20: 7, 21: 7, 22: 7, 24: 8, 26: 7, 27: 7, 28: 7, 31: 7,
    },
    (2026, 11): {
        1: 6, 2: 6.5, 3: 7, 4: 6, 5: 7, 7: 8, 8: 6, 9: 6.5, 10: 7,
    },
}

ms = lambda dt: int(dt.timestamp() * 1000)


def main():
    here = os.path.dirname(os.path.abspath(__file__))
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--db', default=os.path.join(here, '..', 'data', 'shifts.db'))
    ap.add_argument('--dry-run', action='store_true')
    args = ap.parse_args()

    if not os.path.exists(args.db):
        sys.exit(f'Database not found: {args.db} (start the app once to create it)')

    db = sqlite3.connect(args.db)
    todo, skipped = [], []
    for (y, m), days in SHIFTS.items():
        for d, hours in sorted(days.items()):
            start = datetime(y, m, d, *START, tzinfo=TZ)
            day_from, day_to = ms(datetime(y, m, d, tzinfo=TZ)), ms(datetime(y, m, d, tzinfo=TZ) + timedelta(days=1))
            exists = db.execute('SELECT 1 FROM shifts WHERE start_at >= ? AND start_at < ? LIMIT 1', (day_from, day_to)).fetchone()
            (skipped if exists else todo).append((start, hours))

    for start, hours in todo:
        print(f'+ {start:%a %d/%m/%Y %H:%M}  {hours}h')
    if skipped:
        print(f'{len(skipped)} day(s) already have a shift, skipped: ' + ', '.join(f'{s:%d/%m}' for s, _ in skipped))
    print(f'{len(todo)} shift(s) to add, {sum(h for _, h in todo)}h total')

    if args.dry_run or not todo:
        return

    backup = f'{args.db}.backup-{datetime.now():%Y%m%d-%H%M%S}'
    with sqlite3.connect(backup) as b:
        db.backup(b)
    with db:
        db.executemany(
            'INSERT INTO shifts (start_at, end_at) VALUES (?, ?)',
            [(ms(s), ms(s) + int(h * 3_600_000)) for s, h in todo],
        )
    print(f'Done. Backup: {backup}')


if __name__ == '__main__':
    main()
