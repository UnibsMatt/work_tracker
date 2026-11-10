# Bunny Shifts 🐰☕

A tiny clock-in / clock-out app for waitress shifts, with a barista bunny.

- **Start shift / Stop shift** buttons, live timer
- Monthly recap: hours worked, number of shifts, expected money
- The month's shifts are folded into a dropdown that shows total hours and €; tap it to see each shift
- Paid time is rounded to the nearest half hour (12:52 → 13:00, 17:08 → 17:00), no overtime. The exact clock times are kept and shown in small text
- Edit, delete or add shifts by hand (for when you forget to clock out)
- Phone-first layout
- Next.js (frontend + API) and SQLite stored on the host in `./data/shifts.db`
- Login page (username/password from `.env`), stays logged in for 30 days, with a Log out button

## Run

```sh
cp .env.example .env      # then set APP_USER / APP_PASSWORD
docker compose up -d --build
```

Open http://localhost:3333 (or the server's IP on port 3333).

## Pay rules

Each shift is split by percentage between two hourly rates, set in `.env`:

| var | default | meaning |
|---|---|---|
| `PAY_HOURS_A` / `PAY_RATE_A` | 4 / 10 | 4 parts paid at 10 €/h |
| `PAY_HOURS_B` / `PAY_RATE_B` | 3 / 12 | 3 parts paid at 12 €/h |

So 4/7 (57%) of all hours are paid 10 €/h and 3/7 (43%) are paid 12 €/h.
A 7h shift = 4×10 + 3×12 = 76 €. Change the values and run `docker compose up -d` to apply.

## Cloudflare tunnel (https://silvana.bligny44.site)

Option A, cloudflared already running on the host: in the Cloudflare Zero Trust dashboard,
add a public hostname `silvana.bligny44.site` → `http://localhost:3333`.

Option B, run cloudflared inside this stack: create a tunnel in the dashboard, put its token in
`.env` as `CLOUDFLARE_TUNNEL_TOKEN`, point the public hostname to `http://app:3000`, then:

```sh
docker compose --profile tunnel up -d
```

## Backup

Everything is in `./data/`. Copy that folder (ideally with the app stopped) to back up.

## Seeding past shifts

`scripts/seed_shifts.py` adds the October/November 2026 hours (each shift starts at 08:00 Italian time).
Days that already have a shift are skipped, and a backup of the database is made first.

```sh
python3 scripts/seed_shifts.py --dry-run   # preview
python3 scripts/seed_shifts.py             # write to ./data/shifts.db
```

Add more days by editing `SHIFTS` at the top of the script.

## Useful commands

```sh
docker compose logs -f app        # logs
docker compose up -d --build      # rebuild after code changes
docker compose down               # stop
```
