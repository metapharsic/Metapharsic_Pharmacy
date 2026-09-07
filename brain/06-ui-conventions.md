# UI Conventions

Purpose: the interface rules — layout shells, the POS keyboard contract, colour semantics,
component vocabulary, and print output — that every Blade view must follow.

The audience is a pharmacist and one or two counter staff on a shared terminal, working
through an 11 a.m. rush. Speed and unambiguity beat decoration everywhere in this document.

## 1. Layout shells

Two shells, and only two.

| Shell | File | Used by | Chrome |
|---|---|---|---|
| Admin shell | `resources/views/layouts/app.blade.php` | Everything except POS | Fixed left sidebar (240px, collapsible to 64px icons), topbar with shop name, current user, date, and global search |
| POS shell | `resources/views/layouts/pos.blade.php` | `/pos` only | No sidebar, no global search, no notification bell. A 48px top strip with cashier name, shift date, held-bill count, and a single Exit control |
| Print shells | `layouts/print-a4.blade.php`, `layouts/print-80mm.blade.php` | Invoice, receipt, report export | No app chrome at all |
| Auth shell | `layouts/guest.blade.php` | Login, password reset | Centred card |

Admin shell sidebar order mirrors the workday: Dashboard, POS, Sales, Returns, Customers,
Inventory, Purchases, Suppliers, Medicines, Reports, Audit, Settings, Users. Items the current
user lacks permission for are not rendered — a disabled menu item that errors on click is
worse than an absent one.

> **Cave law:** the POS layout carries no navigation. Nothing on the POS screen can lead a
> cashier away mid-bill by accident. Leaving requires the explicit Exit control, and Exit is
> blocked while the cart has lines — hold the bill or complete it.

## 2. The POS keyboard contract

> **Cave law:** the POS is fully operable without a mouse. Every action a cashier performs in
> a normal sale — search, select, quantity, discount, customer, payment, save, print — has a
> key. A feature that can only be reached by clicking is not finished.

| Key | Action | Available when |
|---|---|---|
| `F1` | Toggle the shortcut help overlay | Always |
| `F2` | New customer (inline modal: name, phone, doctor) | Always; returns focus to search on save or cancel |
| `F3` | Focus the medicine search box, clearing it | Always |
| `F4` | Open the payment panel | Cart has at least one line |
| `F9` | Hold the current bill | Cart has at least one line |
| `F10` | Recall a held bill (list, arrow keys, Enter) | Always |
| `Esc` | Clear the current line / close the open dropdown or modal; on an empty line, clear focus back to search | Always |
| `Enter` | Advance: search → batch pick → quantity → next line; in the payment panel, confirm and save | Always |
| `+` | Increment quantity on the focused line | A line is focused |
| `-` | Decrement quantity on the focused line; at 1, prompts to remove the line | A line is focused |
| `↑` / `↓` | Move between cart lines, or between dropdown results | Always |
| `Tab` / `Shift+Tab` | Move between fields within the focused line (qty → discount → back) | A line is focused |
| `Ctrl+D` | Bill-level discount field | Cart has at least one line |
| `Ctrl+P` | Reprint the last completed invoice | After a save in this session |
| `Ctrl+Del` | Remove the focused line entirely (with confirm) | A line is focused |
| `F8` | Cash-drawer / open payment mode cycle (Cash → Card → UPI → Credit) | Payment panel open |

Contract rules:

- Focus starts in the search box on page load and returns there after every completed line and
  after every modal closes. A cashier must never have to find focus.
- A barcode scanner is a keyboard that types digits and presses Enter. Any input of 8+ digits
  terminated by Enter within 100ms per character is treated as a barcode and resolved through
  `api.pos.barcode`, regardless of which field has focus.
- Function keys are captured with `preventDefault()` only on the POS screen, and only for the
  keys listed. The rest of the application uses browser defaults.
- Three characters trigger the medicine dropdown; results are keyboard-navigable from the
  first keystroke, with the first result pre-highlighted so `Enter` alone is a valid path.
- The shortcut strip is printed along the bottom of the POS screen at all times, in muted
  text. New staff should not need the `F1` overlay after the first week, but it stays.
- No shortcut is destructive without confirmation, and no confirmation defaults to the
  destructive answer.

## 3. Colour semantics

Colour carries meaning, and the same meaning everywhere. Never use these colours decoratively.

| State | Treatment | Rule |
|---|---|---|
| Expired batch | `bg-red-100 text-red-800 border-red-300`; the row is struck through and non-selectable | `expiry_date <= today` or `BatchStatus::Expired` / `Quarantined`. **Hard block** — cannot be added to a cart |
| Expiring soon | `bg-amber-100 text-amber-800 border-amber-300` | `expiry_date <= today + 90 days`. Sellable, with a visible warning; the expiry date is shown on the cart line |
| Normal expiry | Plain text, no badge | More than 90 days out. Absence of colour is itself information |
| Low stock | Amber left border on the row plus an amber count | `quantity_available <= medicines.min_stock_level` |
| Out of stock | Grey row, `text-slate-400`, not selectable in POS | No batch with `quantity_available > 0` and a future expiry |
| Prescription required (℞) | Red `℞` badge next to the medicine name, everywhere the medicine appears | `medicines.is_prescription_required` |
| Prescription satisfied | The ℞ badge turns slate once a prescription number is attached | Per sale, per line |
| Credit-blocked customer | Red banner on the customer chip: "Credit blocked — outstanding ₹X of ₹Y limit" | `outstanding + cart total > credit_limit`. Credit payment mode is disabled until an admin override |
| Credit near limit | Amber chip | Above 80% of the limit |
| Free goods line | Small slate "FREE" tag on the purchase line | `free_quantity > 0` |
| Held bill | Slate badge with the count in the POS top strip | Count of bills held by this user; a held bill is not a sale until it is committed |

Additional rules:

- Colour is never the only signal. Every coloured state also carries text or an icon, for
  colour-blind staff and for a cheap monitor with poor contrast.
- Amber means "act soon"; red means "the system will not let you proceed". Nothing red is a
  mere warning, and nothing amber blocks. Staff learn this in a day and then trust it.
- The 90-day and 30-day expiry windows are domain constants from `brain/03-domain-rules.md`,
  read from config, not hardcoded in Blade.

## 4. Tailwind and components

- Tailwind utility classes in the markup; no bespoke CSS files beyond `app.css` (Tailwind
  entry, print rules, and the two font-face declarations). If a utility string repeats three
  times, it becomes a Blade component, not an `@apply` class.
- Design tokens live in `tailwind.config.js`: `brand` (slate-based), `danger` (red),
  `warn` (amber), `ok` (emerald). Views reference the semantic name, never a raw palette step,
  for the states in section 3.
- Base font size 16px; POS cart rows 18px with `tabular-nums` on every numeric column so digits
  align down the column.
- Dark mode is out of scope. The shop terminal runs in a bright room; one well-tested light
  theme beats two half-tested ones.
- Anonymous Blade components in `resources/views/components/`, kebab-case, one file each.
  Class-based components only when the component needs to query or compute.

### The component vocabulary

| Component | Responsibility | Key props |
|---|---|---|
| `x-page-header` | H1, breadcrumb, and the right-aligned primary action slot | `:title`, `:breadcrumbs`, `action` slot |
| `x-data-table` | Sortable, paginated list with a filter bar, empty state, and a fixed header | `:rows`, `:columns`, `:sort`, `empty` slot |
| `x-money` | The single place a rupee amount becomes a string: `₹` prefix, Indian grouping (1,23,456.78), two decimals, `tabular-nums`, negative in red parentheses | `:value` (a `Brick\Money`), `:sign` |
| `x-batch-badge` | Batch number plus expiry, coloured by `BatchStatus` and the expiry window | `:batch` |
| `x-expiry-pill` | Expiry date alone, red/amber/plain per section 3, with a "in N days" title attribute | `:date` |
| `x-rx-badge` | The ℞ marker with its satisfied/unsatisfied state | `:required`, `:satisfied` |
| `x-stat-tile` | Dashboard big number with label, delta, and an optional drill-through link | `:label`, `:value`, `:href` |
| `x-confirm` | Confirmation dialog wrapper; renders the consequence in words, not "Are you sure?" | `:message`, `:action`, `:danger` |
| `x-form.*` | `input`, `select`, `money`, `date`, `textarea`, `checkbox` — label, hint, error slot, and consistent focus ring | `:name`, `:label`, `:hint` |

> **Cave law:** money reaches the screen only through `x-money`. A view that concatenates `'₹'`
> onto a value, or calls `number_format()`, is a defect — one formatting rule, one place.

## 5. Alpine.js

Alpine handles interaction. It never handles the domain.

Rules:

- **Local UI state only:** open/closed, focused index, which tab, an in-flight flag, an
  optimistic highlight. Anything that decides money, stock, tax, or permission is computed on
  the server.
- The POS cart's displayed totals come from `POST /api/pos/quote`. Alpine may show a local
  estimate while the request is in flight, rendered in muted text, but the server number
  replaces it on arrival and the server number is what gets saved.
- No Alpine store holds a price list, a cost, or a permission decision. The client is not a
  trust boundary — see `brain/08-security-and-audit.md`.
- Components are declared in `resources/js/alpine/*.js` and registered with
  `Alpine.data('posCart', …)`. Inline `x-data` expressions stay under one line; anything longer
  moves to a registered component.
- No jQuery, no ad-hoc `fetch` scattered in templates. All POS requests go through one
  `resources/js/pos/api.js` wrapper that handles CSRF, the 422 `error_code` mapping from
  `brain/04-coding-standards.md`, and a single retry on network failure.

### POS cart state shape

The documented shape, because tests and the hold/recall payload both depend on it:

```js
Alpine.data('posCart', () => ({
  customer: null,          // { id, name, phone, outstanding, credit_limit, blocked } | null (walk-in)
  prescription: null,      // { number, doctor_name, date } | null
  lines: [
    {
      key: 'l1',           // client-side line key, not a database id
      medicine: { id, name, is_prescription_required, gst_rate, unit },
      allocations: [       // filled by the server quote; one entry per batch
        { batch_id, batch_no, expiry_date, quantity, unit_price, mrp }
      ],
      quantity: 2,         // requested total; may span several allocations
      discount_percent: 0,
      line_total: null,    // server-computed, null until the quote returns
      gst_amount: null,    // server-computed
      warnings: []         // ['expiring_soon'] etc., server-supplied codes
    }
  ],
  billDiscountPercent: 0,
  payments: [ { mode: 'cash', amount: '130.00', reference: null } ],
  totals: { subtotal: null, discount: null, gst: null, round_off: null, total: null },
  ui: { focusedLine: 0, searchOpen: false, paymentOpen: false, saving: false, quoting: false }
}))
```

Notes that are rules: no `cost` key exists anywhere in this shape and none may be added;
`allocations` is server-assigned (FEFO is not decided in the browser); amounts are strings, not
JS numbers, so that no float ever touches a rupee; a held bill stores exactly this object minus
`ui`, and recall restores it and then immediately re-quotes, because prices and stock may have
moved while the bill waited.

## 6. Forms

- One column, labels above fields. Grouped in `x-card` sections with a section heading when a
  form exceeds about ten fields.
- **Validation errors** render three ways at once: a summary at the top of the form listing
  each failing field as a link, an inline red message under each field, and a red focus ring.
  Focus moves to the first failing field on load. Old input is always repopulated.
- Server-side validation is the only validation that counts. HTML5 attributes (`required`,
  `min`) are a convenience; the Form Request is the rule.
- **Autofocus:** every create/edit form focuses its first meaningful field on load — medicine
  name, customer name, supplier invoice number. The POS focuses search. Search screens focus
  the search box. A screen where the user must click before typing is unfinished.
- **Confirm dialogs** are reserved for actions that are irreversible or that move stock or
  money: purchase confirm, purchase cancel, sale void, stock adjustment, expiry write-off,
  batch quarantine, user deactivation, permission change. Everything else saves without a
  prompt. The dialog states the consequence in words — "This will remove 12 units of
  Paracetamol B1024 from stock and cannot be undone" — never "Are you sure?". Destructive
  buttons are red and never the default focus.
- Every mutating form posts once: the submit button disables on submit and shows a spinner.
  Double-submission of a sale is additionally prevented server-side by an idempotency key
  carried in the POS payload.
- Date inputs are `dd/mm/yyyy` in display and ISO in the payload. Expiry entry accepts `mm/yy`
  and normalises to the last day of that month, because that is what is printed on the box.

## 7. Print layouts

Two print outputs, each with its own shell, each rendered from a route (`sales.invoice`,
`sales.receipt`) so it can be reprinted from history rather than only at sale time.

### A4 tax invoice — `layouts/print-a4.blade.php`

| Section | Contents |
|---|---|
| Header | Shop name, full address, phone, **GSTIN**, **drug licence numbers (DL No. 20B / 21B)**, "TAX INVOICE" title |
| Invoice meta | Invoice number, date and time (`Asia/Kolkata`), cashier name, **registered pharmacist name and registration number** |
| Party block | Customer name, phone, address, doctor name; customer GSTIN when present. "Walk-in customer" when none |
| Prescription block | **Prescription number and prescribing doctor**, printed whenever any line is Schedule H; the override note and approving user when an override was used |
| Line table | S.No, medicine name (with ℞ mark), **HSN code**, batch number, expiry (mm/yy), pack, quantity, MRP, rate, discount, taxable value, GST rate, GST amount, line total |
| Tax summary | **GST breakup per slab** (0/5/12/18) with taxable value, CGST and SGST split at half the rate each, and totals per slab; IGST row appears only for an inter-state customer |
| Totals | Subtotal, discount, total GST, round-off, grand total, and the grand total in words |
| Payment | Mode(s) and amounts, amount paid, balance due |
| Footer | Terms, "Goods once sold are not returnable except as per policy", signature line for the pharmacist, and the software's name and invoice generation timestamp |

### 80mm thermal receipt — `layouts/print-80mm.blade.php`

Width `80mm` with `@page { size: 80mm auto; margin: 2mm; }`. Monospace, 10pt, no colour, no
images beyond an optional 1-bit logo. Content, in order: shop name, address line, GSTIN, drug
licence number, invoice number, date/time, cashier initials, one line per item (name truncated
to fit, then qty × rate = amount on the next line), the per-slab GST summary in compressed
form, total, payment mode, balance, prescription number when applicable, pharmacist name, and
a thank-you line. It is a legal tax invoice in short form, so GSTIN, HSN-bearing tax summary,
drug licence number, and invoice number are not optional even here.

### `@media print` rules

```css
@media print {
  .no-print, nav, aside, .topbar, .toast, button { display: none !important; }
  .print-only { display: block !important; }
  body { background: #fff; color: #000; font-size: 11pt; }
  a[href]::after { content: none; }          /* never print URLs after links */
  table { border-collapse: collapse; }
  thead { display: table-header-group; }     /* repeat headers across pages */
  tfoot { display: table-footer-group; }
  tr, .line-item { break-inside: avoid; }
  .page-break { break-after: page; }
}
```

- Print styles live in `app.css`, never inline in a view.
- Colour semantics do not survive printing. An expiring batch prints its date, not a colour.
- Printing is triggered after the response renders, and only after the sale has committed. A
  failed print is reprinted from `sales.receipt`; it never re-runs the sale.

## 8. Speed and accessibility floor

> **Cave law:** POS medicine search returns in under **150ms** at the 95th percentile with
> 5,000 medicines and 20,000 batches on the shop's own server hardware. This is a hard budget,
> not an aspiration.

That budget is why the schema looks the way it does, and it is measured, not assumed:

- The search hits a trigram index (`pg_trgm` GIN on `medicines.name` and `generic_name`) plus a
  b-tree on `barcode`; `brain/02-database-schema.md` carries the index definitions and this
  requirement is the reason they exist.
- The endpoint selects a fixed, narrow column list through `withoutCost()`, caps at 20 rows,
  and joins no aggregate. Stock availability comes from a per-medicine summary read, not a
  live `SUM` over `stock_transactions`.
- The typeahead debounces at 120ms and cancels the in-flight request on the next keystroke.
- A Pest performance test seeds 5,000 medicines and asserts the query plan uses the index and
  the endpoint stays inside budget. It runs in CI. See `brain/07-testing-strategy.md`.
- If a feature request would push search past the budget, the feature changes, not the budget.

Accessibility floor, which mostly serves the same goal:

- Every interactive element is reachable by keyboard, in a sensible tab order, with a visible
  focus ring that is never removed.
- Contrast meets WCAG AA (4.5:1 for body text). The amber and red states are checked against
  their backgrounds, not assumed.
- Form fields have real `<label for>`. Icon-only buttons carry `aria-label`.
- Modals trap focus, close on `Esc`, and restore focus to the element that opened them.
- Toasts and validation summaries use `aria-live="polite"`; blocking errors use
  `aria-live="assertive"`.
- Tables are real `<table>` markup with `<th scope>`. No div grids for tabular data.
- The application is usable at 1366×768, the resolution of the counter terminal, without
  horizontal scrolling.
