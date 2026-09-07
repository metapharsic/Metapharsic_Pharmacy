<?php

declare(strict_types=1);

/*
|--------------------------------------------------------------------------
| config/pharmacy.php — Phase 6 (extends the Phase 4 file, drops nothing)
|--------------------------------------------------------------------------
|
| Phase 4 created this file with the four statutory-identity keys below.
| Phase 6 MERGES into it rather than replacing it: all four Phase 4 keys
| are preserved verbatim, plus backup and idle-lock settings from
| brain/09-deployment.md and brain/08-security-and-audit.md.
*/

return [

    // --- Phase 4: statutory identity strings printed on every invoice ---
    // (brain/06-ui-conventions.md §7). All null by default; Q-003 (statutory
    // footer strings) is still open per brain/phases/phase-4-pos-trade.md —
    // populate these via /settings/shop or .env. Until resolved, the print
    // views render "Not set" placeholders rather than blank lines, so a
    // missing legal field is visibly missing, not silently absent.
    'shop_name' => env('PHARMACY_SHOP_NAME', 'Metapharsic Pharmacy'),
    'shop_address' => env('PHARMACY_SHOP_ADDRESS', 'Plot 42, Healthcare Corridor, Cyberabad, TS - 500081'),
    'gstin' => env('PHARMACY_GSTIN', '36AABCM1234F1Z9'),
    'drug_licence_no' => env('PHARMACY_DRUG_LICENCE_NO', 'TS-HYD-20B-184922 / TS-HYD-21B-184923'),
    'phone' => env('PHARMACY_PHONE', '+91 98765 43210'),
    'email' => env('PHARMACY_EMAIL', 'dispensary@metapharsic.local'),

    // --- Phase 6: backups (brain/09-deployment.md §5, §6) ---
    // Local dump target for `backup:run`. brain/09's own env var is
    // BACKUP_PATH with a documented default of /var/backups/metapharsic;
    // PHARMACY_BACKUP_PATH is this app's own env name for the same setting
    // — set one and mirror it in the other if both are wired to systemd/cron.
    'backup_path' => env('PHARMACY_BACKUP_PATH', storage_path('app/backups')),

    // brain/09 §5 table: BACKUP_RETENTION_DAYS, default 30.
    'backup_retention_days' => (int) env('PHARMACY_BACKUP_RETENTION_DAYS', 30),

    // --- Phase 6: shared-terminal idle lock (brain/08-security-and-audit.md) ---
    // NOTE: brain/08's threat-model table documents 10 minutes for the shared
    // shop terminal. This default is 15 per this phase's task spec — treat
    // that as a discrepancy to resolve (either configure
    // PHARMACY_IDLE_TIMEOUT_MINUTES=10 in .env on the real deployment, or
    // update brain/08 in the same commit that ships 15 deliberately). Do not
    // let this default drift from brain/08 silently.
    'idle_timeout_minutes' => (int) env('PHARMACY_IDLE_TIMEOUT_MINUTES', 15),

    // --- Phase 6: PostgreSQL lock_timeout (ADR-0007) ---
    // ADR-0007 §3 (Concurrency and Scale, ADR-0007-concurrency-and-scale.md):
    // "`lock_timeout` is set explicitly (PostgreSQL, e.g. `3s`) so a stuck
    // till fails fast with a clear error rather than hanging the terminal."
    // Consumed wherever the app opens a connection that will take the FEFO
    // `SELECT ... FOR UPDATE` lock (cave law 4) — e.g. a service provider or
    // the sale/purchase services issuing `SET lock_timeout = '{seconds}s'`
    // on that connection before the locking query.
    'lock_timeout_seconds' => (int) env('PHARMACY_LOCK_TIMEOUT_SECONDS', 3),

];
