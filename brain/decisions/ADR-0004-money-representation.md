# ADR-0004 — Money is `numeric(12,2)` in the database and a money value object in PHP

Purpose: record how money is stored, carried, calculated and rounded, and why floats are forbidden everywhere in the money path.

**Status:** Accepted
**Date:** 2026-08-24
**Deciders:** orchestrator, pharmacy-domain
**Supersedes:** none
**Related:** `brain/02-database-schema.md` §1, `brain/03-domain-rules.md` §5, `brain/04-coding-standards.md` §7, ADR-0001

## Context

Every bill this system produces is a tax invoice. Its arithmetic is checked twice: by a customer
holding a printed total, and by an accountant reconciling a month of them against a GST return.
A discrepancy of one paisa in one bill is a curiosity; the same discrepancy repeated across nine
thousand bills is a filing that does not tie out.

The arithmetic is not trivial. A line has a rate, a quantity, a line discount, and a GST slab; an
invoice has a bill-level discount that must be distributed across lines whose taxable values do
not divide evenly; tax at 5, 12 or 18 percent splits into two halves that must re-sum exactly to
the whole; and the invoice total is rounded to the rupee with the difference recorded in a
`round_off` field bounded at ±0.50.

Three properties are required, and they are not negotiable:

1. **Exact decimal representation.** `12.10` must be `12.10`, not `12.099999999999999`.
2. **No silent coercion anywhere on the path** — column, driver, model cast, service, view.
3. **Explicit, single-point rounding.** Rounding must happen where the design says it happens and
   nowhere else, so the total always equals the sum of its parts.

`CAVEMAN_DESIGN.md` names this as trap 2: money in float, wrong paise, angry accountant.

## Decision

**Storage:** every money column is `numeric(12,2)` — twelve significant digits, two decimal
places, exact fixed-point. Never `float`, `real`, `double precision`, or PostgreSQL's `money`
type. The upper bound is ₹9,999,999,999.99, far beyond any figure this shop produces, and the
scale is the paisa. Nullable only where "not applicable" genuinely differs from zero; otherwise
`NOT NULL DEFAULT 0`.

**In PHP:** money is a **value object** — the `brick/money` `Money` type, INR, scale 2,
`RoundingMode::HALF_UP` — never a `float`, never an `int` of rupees, and never a string that gets
`+`-ed. Money columns are cast on the model through a `MoneyCast`, so a model never hands out a
raw string or float for a money column. Arithmetic happens on the value object, which refuses to
add different currencies, refuses to silently change scale, and provides `allocate()` for
distributing a remainder across lines without losing or inventing a paisa.

**Percentages are not money.** GST rate and discount percent are `decimal(5,2)` rates. A rate
multiplied by money produces money; a rate is never stored in a money column.

**Rounding policy — rounding happens at exactly two kinds of place, and nowhere else:**

| Step | Rule |
|---|---|
| Per line, per tax component | `HALF_UP` to two decimals when the taxable amount and each of CGST/SGST/IGST are computed. The CGST and SGST halves are derived so that they always re-sum to the line's total tax — one half is computed and the other is the remainder, never both rounded independently |
| Once per invoice, to the rupee | The invoice total is rounded to the whole rupee. The difference goes into `sales.round_off`, constrained to −0.50 … +0.50 |

> **Cave law:** `round_off` is the **only** place an invoice's rounding difference may live. Line
> values are never nudged to make the total come out round. If the arithmetic does not close, the
> arithmetic is wrong — the fix is never to adjust a line.

The invariant every bill must satisfy, asserted in tests and checkable in SQL:

```
subtotal − discount + gst_amount + round_off = total
SUM(sale_items.line_total) + round_off       = total
cgst_amount + sgst_amount + igst_amount      = gst_amount
```

**Where round-off is absorbed:** in the *customer's* total, at the invoice level, and it is
disclosed as a line on the printed invoice — the printed total is the roundest figure and the
recorded arithmetic remains exact behind it. It is never absorbed into a line's taxable value or
into the tax amount, because both feed the GST return and must remain the true figures. It is
never absorbed into the discount, because a discount is a commercial fact and round-off is not.
In reporting, `round_off` is summed as its own column: over a month it is near zero, and a
persistently one-sided sum is a signal that the rounding rule has been implemented wrongly.

**Bill-level discount distribution:** a discount applied to the invoice is distributed across
lines in proportion to their taxable value using the value object's `allocate()`, so that the
remainder paisa lands deterministically on specific lines rather than being lost. The line
totals then re-sum to the discounted subtotal exactly, and each line's tax is computed on its own
discounted taxable value — necessary because lines may sit in different GST slabs.

**Rendering:** formatting is a view concern. A service that returns `"₹1,234.50"` is broken; it
returns a `Money`, and the Blade money component renders it.

## Consequences

### Positive

| Consequence | Why it matters here |
|---|---|
| Paise never vanish and never appear | The whole class of floating-point rounding bugs is structurally excluded, from column to screen |
| The type carries currency and scale | An INR-scale-2 value object cannot be accidentally combined with a rate or a raw number; mistakes become type errors, not wrong invoices |
| Rounding is auditable | It happens at two named points and its residue is a stored column, so any discrepancy has exactly one place to be |
| GST figures are the true figures | Tax and taxable values are never distorted to tidy a total, so the return ties out to the rupee |
| Discount distribution is exact | `allocate()` guarantees the parts re-sum to the whole, including the awkward remainder |
| Reviewable by grep | "Is there a float in the money path?" is answerable mechanically, and it is a review checklist item |

### Negative

| Consequence | What it costs, and how we live with it |
|---|---|
| More verbose than arithmetic on numbers | `$a->plus($b)->multipliedBy($rate, RoundingMode::HALF_UP)` instead of `$a + $b * $rate`. Accepted: the verbosity is the explicitness, and it forces the rounding mode to be stated |
| A dependency sits in the most critical path | `brick/money` is pinned, and its behaviour is covered by our own unit tests, so an upgrade that changed rounding would fail our suite, not the shop's books |
| Casting overhead on every money column | Immaterial at this scale; report aggregation is done in SQL over `numeric`, not by hydrating models |
| `numeric` arithmetic is slower than binary float in the database | Irrelevant at hundreds of bills a day, and the correctness is the point |
| Two paisa of rounding per bill is visible to a customer | It is disclosed as a round-off line on the invoice, which is standard practice and expected |
| Everyone must learn the rule | Mitigated by the money component in views, the cast on models, and review checklist section 5 |

## Alternatives considered

### Integer paise — store `1210` for ₹12.10

**The case for it.** The classic advice, and genuinely sound: integers are exact, fast, trivially
comparable, portable across every language and database, and immune to any decimal-parsing
question. Many payment systems do exactly this.

**Why rejected.** It is correct about representation and weak about everything around it. The
scale lives in a convention rather than in the type, so nothing prevents a paise value being
added to a rupee value — the resulting bug produces a number that looks entirely plausible and
is off by a factor of a hundred. Every read and write needs a conversion at the boundary, and the
conversion is the place the mistake gets made. Raw SQL for reports — which this system does a lot
of — would have to divide by 100 in every projection, so an ad-hoc query run by a maintainer in
`psql` shows figures that are not rupees. And PostgreSQL's `numeric` already gives us exactness
in the database *and* human-readable values, so integer paise would trade legibility for a
property we already have. It remains the right answer for a system without a good decimal type;
this system has one.

### Native PHP `float` with careful rounding

**The case for it.** Simplest to write, fastest to execute, no dependency, and "we will just
round at the end" feels sufficient for a shop where the largest bill is a few thousand rupees.

**Why rejected.** Binary floating point cannot represent `0.10` exactly, so error accumulates
across the multiply-and-sum that every bill performs, and it accumulates differently depending on
the order lines were entered. The failure is intermittent, unreproducible from a bug report, and
appears as a bill that is off by a paisa for reasons nobody can explain. Rounding "at the end"
does not repair it: the intermediate values were already wrong, and the CGST/SGST halves would no
longer re-sum to the tax. This is precisely trap 2 in `CAVEMAN_DESIGN.md`, and it is one of the
eight cave laws for the reason that it is the single most common way small retail software
quietly loses money.

### Decimal strings passed around and formatted at the edges

**The case for it.** PostgreSQL's driver already returns `numeric` as a string, so this is the
zero-work option: keep the string, never parse it, and let the database do all arithmetic in SQL.
Nothing is ever coerced.

**Why rejected.** It only works while every calculation is expressible in a single SQL statement,
and this system's calculations are not: discount distribution across lines, per-slab tax
grouping, and credit-limit checks all involve branching logic that belongs in a service. The
moment a string reaches PHP arithmetic it becomes a float by coercion, which is the failure mode
we are excluding, and the coercion is invisible at the call site. Strings also carry no currency
and no scale, provide no protection against comparing `"12.10"` with `"12.1"`, and give the
static analyser nothing to check. The value object is a string with the invariants attached.

### `bcmath` or `ext-decimal` directly

**The case for it.** Exact arithmetic without a Composer dependency, using an extension that is
often already present.

**Why rejected.** Both give exact arithmetic but neither gives a *type*: values remain strings or
plain objects with no currency, no enforced scale, and no allocation helper for distributing a
remainder — which is exactly where bill-level discounts get subtly wrong. `brick/money` is a thin
layer over precisely this kind of arithmetic that adds the properties we need, so this is not a
rejection of the underlying approach but of using it unwrapped.

## Cave laws created or reinforced

| # | Law | Where it is enforced |
|---|---|---|
| — | Money is `decimal(12,2)`. Never float. Ever. | Migration column types; a static check over migrations; review checklist 4.1–4.2 |
| — | `round_off` is the only place an invoice's rounding difference lives | `sales.round_off` with a `BETWEEN -0.50 AND 0.50` CHECK; `GstCalculationTest` |
| 6 | Snapshot cost onto `sale_items` — history must not move | `cost_price_at_sale` as `numeric(12,2)`; `ProfitSnapshotTest` |

## Revisit conditions

- A currency other than INR is ever required, which would exercise parts of the value object the
  design currently constrains away.
- A statutory change alters the rounding rule for tax invoices, or removes the rupee round-off.
- A money figure appears that exceeds `numeric(12,2)`'s range — which for this shop would mean
  something has gone very wrong elsewhere first.
