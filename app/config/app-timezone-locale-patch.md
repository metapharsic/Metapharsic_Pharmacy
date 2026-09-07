# config/app.php — timezone and locale patch

This is **instructions, not a drop-in file**. Overwriting the whole of
`config/app.php` would destroy other keys already customised on the real
Laravel skeleton (providers list, aliases, etc.). Apply this by hand instead.

Per `CLAUDE.md` ("Locale: India — INR, GST, `Asia/Kolkata` timezone") and
Phase 1 task T-0102, change exactly these two array entries in
`config/app.php`:

```php
'timezone' => 'Asia/Kolkata',

'locale' => 'en_IN',
```

Notes:

- `en_IN` is used rather than plain `en` so any future `Str`/`Number`
  localisation and Carbon locale-aware formatting default to Indian
  conventions. Money formatting itself (₹ prefix, Indian digit grouping) is
  handled separately by the `<x-money>` component per
  `brain/06-ui-conventions.md` §4 — it does not depend on `app.locale`.
- Phase 1 gate G1.7 requires a test asserting
  `config('app.timezone') === 'Asia/Kolkata'` and that a seeded `timestamptz`
  round-trips without drift — this change is what that test verifies.
- Do not set `'fallback_locale'` to anything other than `'en'`; there is no
  `en_IN` fallback resource bundle to fall back to.
