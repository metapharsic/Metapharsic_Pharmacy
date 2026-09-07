# Deployment and Operations

Purpose: how this system is built, released, backed up, restored, watched, and worked around
when it is down.

The production target is one machine standing on a shelf in a pharmacy, with no dedicated
sysadmin. Every procedure here must be executable by the owner from a printed page.

## 1. Environments

| Environment | Where | Database | Purpose | Notes |
|---|---|---|---|---|
| Local development | Developer machine (`C:\Metapharsic_pharmacy`, Laravel Herd or WSL2) | Local PostgreSQL 16 | Build and test | `APP_ENV=local`, `APP_DEBUG=true`, demo seeder available |
| CI | GitHub Actions runner | Ephemeral PostgreSQL 16 service container | The pipeline in `brain/07-testing-strategy.md` | Nothing persists |
| Staging (optional) | A spare box or a VM on the shop LAN | A restored copy of last night's production backup | Rehearse a release and, more importantly, rehearse the restore | Recommended before Phase 4 goes live; it is the same machine used for the quarterly restore drill |
| Shop production | Ubuntu 24.04 LTS server on the shop LAN | PostgreSQL 16, local socket | The shop runs on it | `APP_ENV=production`, `APP_DEBUG=false`, no internet exposure |

Staging is optional in the sense that the shop can run without it, and mandatory in the sense
that the restore drill needs somewhere to restore *to*. Restoring onto the production box to
"check the backup" is how a good backup becomes a bad afternoon.

## 2. Server build

### Specification

Modest, but not shared with anything else:

| Item | Minimum | Comfortable |
|---|---|---|
| CPU | 2 cores | 4 cores |
| RAM | 4 GB | 8 GB |
| Disk | 128 GB SSD | 256 GB SSD, full-disk encrypted |
| Network | Wired LAN, static IP (for example `192.168.1.10`) | Same, plus a UPS |
| OS | Ubuntu Server 24.04 LTS | Same |
| Power | **A UPS is not optional.** A power cut mid-transaction on a machine with no battery is how a database gets corrupted | |

The machine runs the application and nothing else. No shop CCTV software, no accounting
package, no browsing.

### Install

```bash
# 1. Base
sudo apt update && sudo apt upgrade -y
sudo timedatectl set-timezone Asia/Kolkata
sudo apt install -y curl git unzip ufw fail2ban acl

# 2. PHP 8.3
sudo add-apt-repository ppa:ondrej/php -y && sudo apt update
sudo apt install -y php8.3-fpm php8.3-cli php8.3-pgsql php8.3-mbstring \
  php8.3-xml php8.3-curl php8.3-zip php8.3-bcmath php8.3-intl php8.3-gd

# 3. Composer
curl -sS https://getcomposer.org/installer | php && sudo mv composer.phar /usr/local/bin/composer

# 4. PostgreSQL 16
sudo apt install -y postgresql-16 postgresql-contrib-16
sudo -u postgres createuser --pwprompt metapharsic
sudo -u postgres createdb --owner=metapharsic metapharsic_prod
sudo -u postgres psql -d metapharsic_prod -c 'CREATE EXTENSION IF NOT EXISTS pg_trgm;'

# 5. nginx, supervisor, node
sudo apt install -y nginx supervisor
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - && sudo apt install -y nodejs

# 6. Firewall: LAN only, no internet exposure
sudo ufw default deny incoming && sudo ufw default allow outgoing
sudo ufw allow from 192.168.1.0/24 to any port 22
sudo ufw allow from 192.168.1.0/24 to any port 80
sudo ufw allow from 192.168.1.0/24 to any port 443
sudo ufw enable
```

PostgreSQL tuning for this size of box, in `postgresql.conf`: `shared_buffers = 2GB`,
`effective_cache_size = 6GB`, `work_mem = 16MB`, `maintenance_work_mem = 512MB`,
`random_page_cost = 1.1` (SSD), `timezone = 'Asia/Kolkata'`, `log_min_duration_statement = 500`.
`listen_addresses = 'localhost'` — the database is never reachable from the LAN.

Application user and paths: deploy as `metapharsic`, application at
`/var/www/metapharsic/current`, shared writable directories `storage/` and
`bootstrap/cache/` owned by `metapharsic:www-data` with `setfacl` giving `www-data` write
access. php-fpm runs as `www-data`.

nginx serves `/var/www/metapharsic/current/public` over HTTP on the LAN, with a self-signed or
internal-CA certificate on 443 and a redirect from 80. `client_max_body_size 20M` for the
medicine CSV import. Node is present only to build assets; Vite's dev server never runs here.

### Time and locale

`Asia/Kolkata` in three places, all of which must agree: the OS (`timedatectl`), PostgreSQL
(`timezone`), and `config/app.php`. A report that slices by day is wrong the moment they differ.

## 3. `.env` keys

Secrets are marked. Secrets never enter the repository, never enter a screenshot, and never
enter `logs/`.

| Key | Example / value | Secret | Notes |
|---|---|---|---|
| `APP_NAME` | `Metapharsic` | no | Appears in the UI, not on the invoice — the invoice uses shop settings |
| `APP_ENV` | `production` | no | Guards the demo seeder and `preventLazyLoading` |
| `APP_KEY` | `base64:…` | **yes** | Rotating it invalidates sessions and encrypted values |
| `APP_DEBUG` | `false` | no | `true` in production leaks the environment on any error page |
| `APP_URL` | `https://192.168.1.10` | no | Used for absolute URLs in printed documents |
| `APP_TIMEZONE` | `Asia/Kolkata` | no | Must match the OS and the database |
| `APP_LOCALE` | `en_IN` | no | Number and date formatting |
| `DB_CONNECTION` | `pgsql` | no | |
| `DB_HOST` / `DB_PORT` | `127.0.0.1` / `5432` | no | |
| `DB_DATABASE` | `metapharsic_prod` | no | |
| `DB_USERNAME` | `metapharsic` | no | Holds no `UPDATE`/`DELETE` on the append-only tables |
| `DB_PASSWORD` | — | **yes** | |
| `SESSION_DRIVER` | `database` | no | Survives a php-fpm restart; admin can revoke |
| `SESSION_LIFETIME` | `480` | no | One shift |
| `SESSION_EXPIRE_ON_CLOSE` | `true` | no | |
| `SESSION_SECURE_COOKIE` | `true` | no | With the LAN TLS certificate in place |
| `CACHE_STORE` | `file` | no | Dashboard 5-minute cache (cave law 8); `database` also acceptable |
| `QUEUE_CONNECTION` | `database` | no | Print jobs, imports, summary rebuilds — no Redis in the shop (CONFLICT-001) |
| `LOG_CHANNEL` | `daily` | no | |
| `LOG_LEVEL` | `warning` | no | `debug` in production fills the disk |
| `MAIL_MAILER` | `smtp` or `log` | no | Only used for the nightly alert mail; `log` if the shop has no outbound mail |
| `MAIL_HOST` / `MAIL_PORT` / `MAIL_USERNAME` | — | username **yes** | |
| `MAIL_PASSWORD` | — | **yes** | |
| `ALERT_EMAIL` | owner's address | no | Where `stock:verify` and backup failures go |
| `BACKUP_PATH` | `/var/backups/metapharsic` | no | |
| `BACKUP_RETENTION_DAYS` | `30` | no | |
| `BACKUP_REMOTE_TARGET` | NAS path or `rclone` remote | no | The destination, not the credential |
| `BACKUP_ENCRYPTION_RECIPIENT` | `age` public key | no | The public half is not a secret; the private key lives off the machine |
| `POS_SEARCH_LIMIT` | `20` | no | Part of the 150ms budget |
| `EXPIRY_WARN_DAYS` | `90` | no | Amber window (`brain/06-ui-conventions.md`) |
| `EXPIRY_ALERT_DAYS` | `30` | no | Dashboard alert window |
| `DISCOUNT_OVERRIDE_PERCENT` | `10` | no | Above this, an override is required and audited |
| `INVOICE_PREFIX` | `PHARM` | no | Series prefix; the year segment is computed |
| `VITE_APP_NAME` | `${APP_NAME}` | no | Build-time only |

`.env` is `0600`, owned by `metapharsic`. A copy of the non-secret keys lives in
`.env.example`, kept current in the same commit as any new key.

## 4. Deploy procedure

Releases go out **before opening or after closing**, never during shop hours. A release during
the 11 a.m. rush is a self-inflicted outage.

1. **Pre-flight.** CI green on `main`, including `stock:verify` (step 14). Read the release's
   migration list. Confirm the phase's definition of done in `workflow/definition-of-done.md`.
2. **Announce.** Tell the counter staff the system will be unavailable for roughly five
   minutes, and confirm no bill is open and no bill is held that must survive — held bills do
   survive, but confirm anyway.
3. **Take a backup now**, not the one from last night:
   `sudo -u postgres pg_dump -Fc metapharsic_prod > /var/backups/metapharsic/pre-deploy-$(date +%F-%H%M).dump`
   Verify the file is non-zero and note its size.
4. **Fetch the release** into a new directory: `/var/www/metapharsic/releases/<timestamp>`,
   `git fetch --tags && git checkout <tag>`.
5. **Install dependencies**: `composer install --no-dev --optimize-autoloader --no-interaction`.
6. **Build assets**: `npm ci && npm run build`.
7. **Link shared state**: symlink `.env`, `storage/`, and the public storage link into the new
   release directory.
8. **Maintenance mode**: `php artisan down --render="errors::503" --retry=60` from the *current*
   release.
9. **Migrate**: `php artisan migrate --force`. Read the output. If a migration fails, stop and
   go to the rollback path — do not attempt to "just re-run it".
10. **Warm caches**: `php artisan config:cache route:cache view:cache event:cache`
    (individually; each must succeed). `php artisan optimize` is the shorthand.
11. **Flip the symlink**: `ln -sfn releases/<timestamp> current`, then
    `sudo systemctl reload php8.3-fpm && sudo systemctl reload nginx`.
12. **Restart workers**: `php artisan queue:restart && sudo supervisorctl restart metapharsic-worker:*`.
    A worker still running the previous release's code is a subtle, awful bug.
13. **Bring it up**: `php artisan up`.
14. **Smoke test, by hand, every time**: log in as admin; log in as a cashier on the counter
    terminal; open `/pos`; search a medicine and confirm results appear instantly; ring a
    one-rupee test sale to a walk-in customer; print it to the thermal printer; return it;
    confirm the batch quantity is back where it started; run `php artisan stock:verify` and see
    exit 0. Delete nothing — the test sale and its return stay in history, as designed.
15. **Record it**: append the release tag, time, migrations run, and smoke-test result to
    `logs/build-log.md`. Keep the last five release directories and delete older ones.

### Rollback path

Code-only release (no migrations, or only additive ones):

1. `php artisan down`
2. `ln -sfn releases/<previous-timestamp> current`
3. `php artisan optimize:clear && php artisan optimize` from the previous release
4. `sudo systemctl reload php8.3-fpm`, restart workers, `php artisan up`
5. Smoke test as in step 14.

Release with a destructive migration (a dropped or renamed column, a backfill):

1. `php artisan down`
2. Restore the step 3 pre-deploy dump into a **new** database:
   `sudo -u postgres pg_restore -C -d postgres /var/backups/metapharsic/pre-deploy-….dump`
3. Point `.env` at the restored database, flip the symlink to the previous release, clear and
   rebuild caches, restart php-fpm and workers, `php artisan up`.
4. Any bills rung after the deploy and before the rollback exist only in the failed release's
   database. Keep that database, do not drop it; re-enter those bills by hand using the manual
   fallback procedure in section 9, and reconcile against the printed invoices.

> **Cave law:** never fix a failed migration by editing the migration file that already ran, and
> never run `migrate:fresh`, `migrate:reset`, or `db:wipe` against the shop database. Forward
> with a new migration, or restore from the pre-deploy dump. There is no third option.

Migration discipline that makes rollback survivable: expand then contract. Add the new column,
deploy code that writes both, backfill in a separate migration, deploy code that reads the new
one, and only drop the old column a release later. A rollback in the middle then costs nothing.

## 5. Scheduled jobs and workers

One cron entry runs Laravel's scheduler; everything else is defined in
`routes/console.php` and `app/Console/Kernel`-equivalent scheduling.

```cron
# /etc/cron.d/metapharsic  — user: metapharsic
* * * * * metapharsic cd /var/www/metapharsic/current && php artisan schedule:run >> /dev/null 2>&1
```

| Job | Schedule (`Asia/Kolkata`) | Purpose | On failure |
|---|---|---|---|
| `summary:rebuild` | 00:30 daily, plus on demand | Rebuild `daily_sales_summary` for yesterday (cave law 8) | Log + alert; dashboard falls back to live queries |
| `stock:verify` | 01:00 daily | Cave law 7 integrity check | **Email the owner**, raise the dashboard alert |
| `backup:run` | 02:00 daily | `pg_dump`, encrypt, copy off-machine, prune | **Email the owner** |
| `expiry:scan` | 06:00 daily | Move batches past `expiry_date` to `BatchStatus::Expired` so they cannot be allocated, and raise the 90/30-day alerts | Log + alert; retried next morning |
| `backup:report` | 08:45 daily | One line to the dashboard: last successful backup, size, off-machine copy status | — |
| `logs:prune` | 03:00 weekly | Trim application logs beyond rotation | Log |
| `queue:prune-failed` | 03:15 weekly | `--hours=336` | Log |
| `sessions:prune` | 03:20 weekly | Expired database sessions | Log |
| `analytics:movers` | 03:30 weekly | Refresh fast/slow-mover aggregates | Log |

Queue workers are supervised, not left to `nohup`:

```ini
; /etc/supervisor/conf.d/metapharsic-worker.conf
[program:metapharsic-worker]
process_name=%(program_name)s_%(process_num)02d
command=php /var/www/metapharsic/current/artisan queue:work database --sleep=3 --tries=3 --max-time=3600 --backoff=10
autostart=true
autorestart=true
stopwaitsecs=3600
user=metapharsic
numprocs=2
redirect_stderr=true
stdout_logfile=/var/log/metapharsic/worker.log
stdout_logfile_maxbytes=10MB
stdout_logfile_backups=5
```

Two workers is right for one shop: enough that a slow CSV import does not block a print job,
few enough that they never compete for the database. `--max-time=3600` recycles them hourly so
a leak cannot accumulate. Nothing that moves stock or money runs on the queue — those happen
inside the request's transaction. Queued work is printing, importing, summarising, and mail.

## 6. Backup and restore

### Nightly backup

`backup:run` at 02:00 does, in order:

1. `pg_dump -Fc` (custom format, compressed) of `metapharsic_prod` to
   `${BACKUP_PATH}/metapharsic-YYYY-MM-DD.dump`.
2. Dump `.env` (secrets included) separately and encrypt it too — a database without its
   `APP_KEY` cannot decrypt what it holds.
3. Encrypt both with `age` to `BACKUP_ENCRYPTION_RECIPIENT`. The private key lives off the
   machine — in the owner's safe and in one other physical place. A backup encrypted with a key
   stored beside it protects nobody.
4. Copy to the off-machine target (`BACKUP_REMOTE_TARGET`: a NAS on the LAN, and a rotating USB
   drive the owner takes home weekly). Verify the copy by size and checksum, not by exit code
   alone.
5. Prune local dumps older than `BACKUP_RETENTION_DAYS` (30). Keep the first dump of each month
   for 12 months; those are never pruned automatically.
6. Write a `backup.completed` audit row and record size, duration, and destination status.
7. On any failure at any step: email `ALERT_EMAIL` immediately and raise the dashboard alert.
   Silence is not success — `backup:report` at 08:45 states the last successful backup's age
   every morning, so a silently dead job is visible within a day.

Restore time objective: **under one hour** to a working system on the spare machine.
Recovery point objective: **one day** — the loss window is one shop day of bills, which the
printed invoices in the drawer can reconstruct (section 9).

### The restore drill

> **Cave law:** an untested backup is not a backup. It is a file. The drill below runs
> **quarterly**, on a machine that is not the production server, and the result — date, dump
> used, time taken, row counts, and who ran it — is recorded in `logs/build-log.md`. A quarter
> without a recorded drill means the shop currently has no backup, and that is the finding.

1. Pick a dump **at random** from the last 30 days. Not the newest — the newest is the one most
   likely to work, which makes it the least informative test.
2. On the staging or spare machine, decrypt: `age -d -i ~/keys/metapharsic.key backup.dump.age > backup.dump`.
   If the key cannot be found, the drill has already failed and that is the most valuable
   result it will ever produce.
3. Create an empty target: `sudo -u postgres createdb metapharsic_restore_test`.
4. Restore: `sudo -u postgres pg_restore -d metapharsic_restore_test --no-owner --clean --if-exists backup.dump`. Note the time taken and any errors.
5. Point a checkout of the matching release tag at the restored database and run
   `php artisan migrate --pretend` — it must report nothing pending. If it reports pending
   migrations, the backup predates the deployed schema and the release procedure needs fixing.
6. **Verify integrity, not just that it loaded**: `php artisan stock:verify` must exit 0.
7. **Verify content against reality**: pick the date of the dump, open the restored system, and
   check that day's sales total, bill count, and closing cash against the printed day-end
   report from the shop's file. The numbers must match exactly.
8. Log in as admin, open the POS, ring a test sale, print it. A database that restores but
   cannot bill is not a recovered shop.
9. Drop the test database. Record the result. If any step failed, fix the backup process **that
   week** — not "before the next drill".

### Restoring for real

Same steps 2–5 against a fresh production database, then update `.env` if the database name
changed, `php artisan optimize:clear && php artisan optimize`, restart php-fpm and workers, run
`stock:verify`, and only then let staff back on. Write down the recovery point (the dump's
timestamp) before anyone starts billing, because everything between that timestamp and now must
be re-entered from paper (section 9).

## 7. Monitoring for a shop

No Prometheus, no Grafana, no on-call rotation. A dashboard panel and a morning email.

**Every morning, before opening (the owner's 60-second check):**

| Check | Where | Good looks like |
|---|---|---|
| Last night's backup | Dashboard ops panel / `backup:report` mail | Completed, plausible size, off-machine copy confirmed, less than 24 hours old |
| `stock:verify` | Dashboard ops alert | Clean. **Any drift is investigated the same morning, before billing continues** — the ledger is the shop's inventory truth |
| Disk free | Dashboard ops panel | Above 20%. Below 15% raises an alert; a full disk stops PostgreSQL and stops the shop |
| Queue health | Dashboard ops panel | Failed jobs at zero, workers running, no job older than a few minutes |
| Yesterday's totals | Dashboard | Sales, bill count, and cash figure look like a normal day. A wildly wrong number is usually an operator error found faster here than in a report next month |
| Error log | `storage/logs/laravel-*.log` tail | No new `error`-level entries. Domain exceptions log at `warning` and are normal |

**Weekly:** review failed logins and any account locked out; review stock adjustments by user
and by reason; confirm the USB backup drive was actually taken home; check `apt list
--upgradable` and schedule security updates for a closed day.

**Quarterly:** the restore drill (section 6); review the permission matrix against who actually
works there now; test the UPS by pulling mains power with the shop closed.

Alerting is deliberately narrow, because an alert nobody reads is worse than no alert. Only
four things email the owner: backup failure, `stock:verify` drift, disk below 15%, and the
queue stalled for more than 30 minutes.

Log rotation: `logrotate` on `/var/log/nginx/*`, `/var/log/metapharsic/*`, and PostgreSQL logs
— daily, 14 files, compressed. Laravel's `daily` channel keeps 14 days. PostgreSQL keeps
`log_min_duration_statement = 500` so slow queries are visible without volume.

## 8. Printers and scanners

**Thermal receipt printer (80mm)** — typically an EPSON TM-T82 or compatible on USB.

- Connect over USB and install via CUPS with the generic ESC/POS or vendor PPD. Confirm the
  paper width is set to 80mm in the driver, not 58mm; the wrong width silently truncates the
  right edge of every receipt, which usually removes the amount column.
- Printing goes through the browser on the counter terminal, not through the server: the
  receipt route renders HTML, `layouts/print-thermal.blade.php` sets `@page { size: 80mm auto }`,
  and the browser prints to the default printer.
- Set the terminal browser's default printer to the thermal unit, margins to none, and headers
  and footers off. A browser-added URL footer on a tax invoice is a compliance defect.
- Keep a spare paper roll and a spare USB cable in the drawer. Test the printer as part of every
  deploy smoke test.

**A4 invoice printer** — any network or USB laser. Set as the non-default printer; the invoice
route prints to it explicitly. Duplex off; a two-sided tax invoice invites a lost second page.

**Barcode scanner** — a USB HID scanner, which is a keyboard. No driver, no configuration in the
application.

- Configure the scanner (with its manual's setup barcodes) to append Enter as a suffix and to
  transmit no prefix beyond the sentinel described in `brain/08-security-and-audit.md`.
- Set the keyboard layout on the scanner to US, matching the terminal, or digits arrive wrong.
- Test after setup: scan a medicine into a text editor and confirm exactly the digits plus a
  newline appear.
- The POS treats a fast digit burst ending in Enter as a barcode regardless of focus. If a
  scanner starts typing into the wrong field, that is the sentinel configuration, not the
  application.

Both printers and the scanner belong to the counter terminal, not the server. The server can be
replaced without touching them.

## 9. When the server is down mid-day

It will happen: a dead disk, a failed power supply, a bad release nobody rolled back in time.
The shop cannot stop selling. This procedure is **printed and kept in the counter drawer**,
because if the server is down the copy in the wiki is unreachable too.

### Immediately (first two minutes)

1. Do not panic and do not start restoring during the rush. Serving customers comes first.
2. Check the obvious in order: is the server powered? Is the network switch powered? Can the
   terminal reach `https://192.168.1.10`? Is it only this terminal, or all of them?
3. If it is not fixed within five minutes, switch to manual and fix it after closing or during
   a lull. A half-attempted repair with customers waiting produces both a queue and a mistake.

### Manual fallback

1. Switch to the **duplicate paper bill book** — pre-printed, carbon-copy, carrying the shop
   name, address, GSTIN, and **drug licence numbers**, and pre-numbered in a series reserved for
   this purpose (`MANUAL/26-27/0001…`). The book is kept in the drawer, checked at every
   quarterly drill, and refilled before it runs out.
2. For each sale write: date and time, customer name and phone (mandatory for credit and for any
   Schedule H line), and per line the medicine name, **batch number and expiry copied from the
   physical box**, quantity, MRP, rate, and amount. Batch and expiry are what make re-entry
   possible; without them, FEFO and the ledger cannot be reconstructed and the stock figures
   never come right.
3. Schedule H sales still require the prescription number and the doctor's name, written on the
   bill, and the pharmacist's initials. The law does not pause when the server does.
4. Credit sales: only for customers the pharmacist knows are within their limit. If unsure, take
   cash. A credit limit cannot be checked, so the conservative call is the correct one.
5. Keep cash separately countable — a rubber-banded stack of manual bill carbons with the cash
   for that period — so the day's till still reconciles.
6. Note the exact time the system went down and, later, the time it came back. That window
   defines what must be re-entered.

### Restoring service

1. Diagnose: server power, disk full (`df -h`), PostgreSQL running (`systemctl status
   postgresql`), php-fpm running, nginx running, disk errors in `dmesg`.
2. If it is a bad release, roll back (section 4). If it is a dead machine, restore last night's
   backup onto the spare machine (section 6) — which the quarterly drill has already proven
   takes under an hour.
3. Before letting anyone bill again, run `php artisan stock:verify` and confirm the last
   invoice number in the system. Re-entry must continue **after** that number.

### Re-entering the manual bills

1. Re-enter after closing, not during trade, and re-enter **in the order the paper bills were
   written**, so FEFO allocation consumes batches in a sequence resembling reality.
2. Enter each as a normal sale, but set the batch on each line to the batch number written on
   the paper bill, overriding the FEFO suggestion where they differ. This is the one place the
   system permits choosing a batch by hand, and the reason `sale_items` carries
   `medicine_batch_id`.
3. Record the manual bill number in the sale's notes field, so the paper bill and the digital
   invoice can be tied together by an inspector or an accountant later.
4. If a sale was made against stock the system did not know existed, the fix is a stock
   adjustment with reason `CountingError` and a note naming the manual bill — an admin action,
   audited. Never invent a batch to make a number fit.
5. Re-enter payments with their real modes, and credit sales against the real customer, so
   outstanding balances end correct.
6. After the last re-entry: run `php artisan stock:verify` (exit 0 required), then take a
   physical count of the medicines that moved during the outage and reconcile. Print the day's
   report and compare it against the manual bill carbons, total by total.
7. File the paper carbons with the date and the outage window written on the top sheet, and
   keep them for the retention period in `brain/08-security-and-audit.md`. They are the primary
   record for that window, and the digital entries are the copy.
8. Write the outage, its cause, its duration, and the re-entry result into `logs/build-log.md`.
   An outage with no written cause is an outage that happens again.
