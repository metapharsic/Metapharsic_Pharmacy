{{--
    POS screen — brain/06-ui-conventions.md §2 (keyboard contract), §5 (Alpine cart shape),
    §3 (colour semantics).

    CAVE LAW: every rupee figure rendered by this page's Alpine state is a client-side
    PREVIEW ONLY, for UX responsiveness while a request is in flight. It is never trusted.
    The authoritative totals come back from POST /api/pos/quote (server recompute) and the
    number that is actually SAVED is computed again, from scratch, inside
    PosController::store() -> SalesService::createSale(), against locked batch rows. No
    Alpine store here holds a price list, a cost, or a permission decision — see brain/06 §5
    and brain/08-security-and-audit.md. If this comment and the code ever disagree, the code
    is wrong.

    Layout choice: this file is kept self-contained (inline Alpine `x-data`, one <script>
    block) with two partials split out for the payment panel and search-results dropdown —
    resources/views/pos/_payment-panel.blade.php and resources/views/pos/_search-results.blade.php
    — because both are reused as their own re-render targets and are long enough to clutter
    this file. Everything else (cart lines, key handling, hold/recall) stays inline.
--}}
@extends('layouts.pos')

@section('content')
<div
    x-data="posCart()"
    x-init="init()"
    @keydown.window="handleKey($event)"
    class="flex h-full flex-col"
>
    {{-- Shortcut strip — brain/06 §2: "printed along the bottom ... at all times" --}}
    <div class="order-2 shrink-0 border-t border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-500 flex flex-wrap gap-x-4">
        <span><kbd>F1</kbd> Help</span>
        <span><kbd>F2</kbd> New customer</span>
        <span><kbd>F3</kbd> Search</span>
        <span><kbd>F4</kbd> Payment</span>
        <span><kbd>F9</kbd> Hold</span>
        <span><kbd>F10</kbd> Recall</span>
        <span><kbd>Esc</kbd> Clear line</span>
        <span><kbd>+/-</kbd> Qty</span>
        <span><kbd>Ctrl+D</kbd> Bill discount</span>
        <span><kbd>Ctrl+P</kbd> Reprint last</span>
        <span><kbd>Ctrl+Del</kbd> Remove line</span>
        <span><kbd>F8</kbd> Payment mode</span>
    </div>

    <div class="order-1 flex flex-1 gap-4 overflow-hidden p-4">
        {{-- Left: search + cart --}}
        <div class="flex flex-1 flex-col gap-3 overflow-hidden">
            {{-- Customer chip (F2 opens modal) --}}
            <div class="flex items-center justify-between rounded border border-slate-200 bg-white px-3 py-2">
                <div>
                    <template x-if="!customer">
                        <span class="text-slate-500">Walk-in customer</span>
                    </template>
                    <template x-if="customer">
                        <div class="flex items-center gap-2">
                            <span class="font-medium" x-text="customer.name"></span>
                            <span class="text-slate-400" x-text="customer.phone"></span>
                            <template x-if="customer.blocked">
                                <span class="rounded border border-red-300 bg-red-100 px-2 py-0.5 text-xs text-red-800">
                                    Credit blocked — outstanding ₹<span x-text="customer.outstanding"></span> of ₹<span x-text="customer.credit_limit"></span> limit
                                </span>
                            </template>
                        </div>
                    </template>
                </div>
                <button type="button" class="text-sm text-brand-700 underline" @click="openCustomerModal()">F2 New / change customer</button>
            </div>

            {{-- Search box — F3 focuses + clears; autofocus on load per brain/06 §6 --}}
            <div class="relative">
                <input
                    type="text"
                    x-ref="search"
                    x-model="ui.searchTerm"
                    @input.debounce.120ms="onSearchInput()"
                    @keydown.arrow-down.prevent="moveSearchHighlight(1)"
                    @keydown.arrow-up.prevent="moveSearchHighlight(-1)"
                    @keydown.enter.prevent="onSearchEnter()"
                    @keydown.escape.prevent="clearSearch()"
                    autofocus
                    placeholder="Search medicine, or scan barcode…"
                    aria-label="Medicine search"
                    class="w-full rounded border border-slate-300 px-3 py-2 text-lg focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
                >
                @include('pos._search-results')
            </div>

            {{-- Cart lines --}}
            <div class="flex-1 overflow-y-auto rounded border border-slate-200 bg-white">
                <table class="w-full text-left">
                    <thead class="sticky top-0 bg-slate-50 text-sm text-slate-500">
                        <tr>
                            <th scope="col" class="px-2 py-2">Medicine</th>
                            <th scope="col" class="px-2 py-2">Batch / Expiry</th>
                            <th scope="col" class="px-2 py-2 text-right">Qty</th>
                            <th scope="col" class="px-2 py-2 text-right">Rate</th>
                            <th scope="col" class="px-2 py-2 text-right">Disc %</th>
                            <th scope="col" class="px-2 py-2 text-right">Line total</th>
                            <th scope="col" class="px-2 py-2"></th>
                        </tr>
                    </thead>
                    <tbody class="text-lg tabular-nums">
                        <template x-for="(line, index) in lines" :key="line.key">
                            <tr
                                :class="ui.focusedLine === index ? 'bg-brand-50' : ''"
                                @click="ui.focusedLine = index"
                                class="border-t border-slate-100"
                            >
                                <td class="px-2 py-2">
                                    <div class="font-medium" x-text="line.medicine.name"></div>
                                    <div class="flex items-center gap-1.5 mt-0.5 text-xs">
                                        <template x-if="line.medicine.is_prescription_required">
                                            <span
                                                class="rounded px-1 font-bold"
                                                :class="line.prescriptionSatisfied ? 'bg-slate-200 text-slate-600' : 'bg-red-100 text-red-800'"
                                                title="Schedule H"
                                            >℞</span>
                                        </template>
                                        <template x-if="line.medicine.rack_location">
                                            <span class="inline-flex items-center rounded bg-indigo-50 border border-indigo-200 px-1.5 py-0.5 font-mono text-[11px] text-indigo-700" x-text="line.medicine.rack_location"></span>
                                        </template>
                                    </div>
                                </td>
                                <td class="px-2 py-2 text-sm">
                                    <template x-for="alloc in line.allocations" :key="alloc.batch_id">
                                        <div :class="expiryClass(alloc.expiry_date)">
                                            <span x-text="alloc.batch_no"></span> · <span x-text="alloc.expiry_date"></span>
                                        </div>
                                    </template>
                                </td>
                                <td class="px-2 py-2 text-right">
                                    <span x-text="line.quantity"></span>
                                </td>
                                <td class="px-2 py-2 text-right">
                                    <span x-text="line.unit_price_preview"></span>
                                </td>
                                <td class="px-2 py-2 text-right">
                                    <span x-text="line.discount_percent"></span>
                                </td>
                                <td class="px-2 py-2 text-right">
                                    {{-- preview only — server-quoted value once /api/pos/quote returns --}}
                                    <span x-text="line.line_total ?? '…'"></span>
                                </td>
                                <td class="px-2 py-2">
                                    <button type="button" class="text-slate-400 hover:text-red-600" aria-label="Remove line" @click="removeLine(index)">✕</button>
                                </td>
                            </tr>
                        </template>
                        <template x-if="lines.length === 0">
                            <tr><td colspan="7" class="px-2 py-8 text-center text-slate-400">Cart is empty — search or scan to begin</td></tr>
                        </template>
                    </tbody>
                </table>
            </div>

            {{-- Totals strip (preview) --}}
            <div class="flex items-center justify-end gap-6 rounded border border-slate-200 bg-white px-4 py-3 text-lg tabular-nums">
                <span>Subtotal: <strong x-text="totals.subtotal ?? '—'"></strong></span>
                <span class="flex items-center gap-2">
                    Bill discount %:
                    <input
                        type="number"
                        min="0"
                        max="100"
                        step="0.01"
                        aria-label="Bill discount percent"
                        x-ref="billDiscount"
                        x-model.number="billDiscountPercent"
                        @change="requote()"
                        class="w-20 rounded border border-slate-300 px-2 py-1 text-right text-base"
                    >
                    <strong x-text="totals.discount ?? '—'"></strong>
                </span>
                <span>GST: <strong x-text="totals.gst ?? '—'"></strong></span>
                <span>Round-off: <strong x-text="totals.round_off ?? '—'"></strong></span>
                <span class="text-2xl">Total: <strong x-text="totals.total ?? '—'"></strong></span>
                <span x-show="ui.quoting" class="text-sm text-slate-400">recalculating…</span>
            </div>
        </div>

        {{-- Right: hold slots + payment panel --}}
        <div class="flex w-96 shrink-0 flex-col gap-3 overflow-y-auto">
            <div class="rounded border border-slate-200 bg-white p-3">
                <h2 class="mb-2 text-sm font-medium text-slate-500">Held bills (F10)</h2>
                <div class="flex flex-wrap gap-1">
                    <template x-for="slot in 9" :key="slot">
                        <button
                            type="button"
                            :aria-label="heldSlots.includes(slot) ? `Recall held bill ${slot}` : `Hold bill to slot ${slot}`"
                            class="rounded border px-2 py-1 text-xs"
                            :class="heldSlots.includes(slot) ? 'border-slate-400 bg-slate-200 text-slate-700' : 'border-slate-200 text-slate-300'"
                            @click="heldSlots.includes(slot) ? recallBill(slot) : holdBill(slot)"
                            x-text="slot"
                        ></button>
                    </template>
                </div>
            </div>

            <div x-show="ui.paymentOpen" x-cloak>
                @include('pos._payment-panel')
            </div>
        </div>
    </div>

    {{-- F2 new customer modal — replaces the old dead stub (openCustomerModal() used to be a
         no-op and this block used to be a bare comment). Phone-search lookup + quick-add,
         same overlay/x-cloak/Esc pattern as the F1 help overlay below. Closes via
         closeCustomerModal() (Esc or explicit action), never leaves the cashier on a
         half-open modal mid-bill. --}}
    <div
        x-show="ui.customerModalOpen"
        x-cloak
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
        @keydown.escape="closeCustomerModal()"
    >
        <div class="w-full max-w-md rounded bg-white p-6 shadow-lg" @click.outside="closeCustomerModal()">
            <div class="mb-3 flex items-center justify-between">
                <h2 class="text-lg font-semibold">Customer (F2)</h2>
                <button type="button" class="text-slate-400 hover:text-slate-600" @click="closeCustomerModal()">&times;</button>
            </div>

            {{-- Lookup --}}
            <label class="mb-1 block text-sm font-medium text-slate-600" for="customer-phone-search">Search by phone</label>
            <input
                id="customer-phone-search"
                type="text"
                x-ref="customerPhoneSearch"
                x-model="ui.customerPhoneQuery"
                @input.debounce.200ms="searchCustomers()"
                aria-label="Customer phone"
                placeholder="Enter phone number"
                class="mb-2 w-full rounded border border-slate-300 px-3 py-2"
                autocomplete="off"
            >
            <span x-show="ui.customerSearching" class="text-xs text-slate-400">searching…</span>

            <ul class="mb-3 max-h-48 divide-y divide-slate-100 overflow-y-auto rounded border border-slate-200">
                <template x-for="result in ui.customerResults" :key="result.id">
                    <li class="flex items-center justify-between px-3 py-2 text-sm">
                        <div>
                            <div class="font-medium" x-text="result.name"></div>
                            <div class="text-slate-400" x-text="result.phone"></div>
                            <div class="text-xs text-slate-400">
                                Outstanding ₹<span x-text="result.outstanding"></span> / limit ₹<span x-text="result.credit_limit"></span>
                                <span x-show="result.blocked" class="text-red-700">(blocked)</span>
                            </div>
                        </div>
                        <button type="button" class="text-sm text-brand-700 underline" @click="selectCustomer(result)">select</button>
                    </li>
                </template>
                <li x-show="!ui.customerSearching && ui.customerPhoneQuery.length > 0 && ui.customerResults.length === 0" class="px-3 py-2 text-sm text-slate-400">
                    No matches.
                </li>
            </ul>

            <button type="button" class="mb-4 text-sm text-slate-500 underline" @click="clearCustomer()">Walk-in / no customer</button>

            {{-- Quick-add --}}
            <div class="border-t border-slate-200 pt-3">
                <h3 class="mb-2 text-sm font-semibold text-slate-600">Quick add</h3>
                <div class="flex flex-col gap-2">
                    <input
                        type="text"
                        x-model="ui.customerQuickAdd.name"
                        aria-label="New customer name"
                        placeholder="Name"
                        class="rounded border border-slate-300 px-3 py-2"
                    >
                    <input
                        type="text"
                        x-model="ui.customerQuickAdd.phone"
                        aria-label="New customer phone"
                        placeholder="Phone (optional)"
                        class="rounded border border-slate-300 px-3 py-2"
                    >
                    <span x-show="ui.customerQuickAddError" class="text-xs text-red-600" x-text="ui.customerQuickAddError"></span>
                    <button
                        type="button"
                        class="rounded bg-brand-700 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
                        :disabled="ui.customerQuickAddSaving || !ui.customerQuickAdd.name"
                        @click="quickCreateCustomer()"
                    >
                        Create &amp; select
                    </button>
                </div>
            </div>
        </div>
    </div>

    {{-- F1 help overlay --}}
    <div x-show="ui.helpOpen" x-cloak class="fixed inset-0 z-50 flex items-center justify-center bg-black/40" @keydown.escape="ui.helpOpen = false">
        <div class="max-w-lg rounded bg-white p-6 shadow-lg">
            <h2 class="mb-2 text-lg font-semibold">Keyboard shortcuts</h2>
            <p class="text-sm text-slate-500">See the strip at the bottom of the screen. Press F1 or Esc to close.</p>
        </div>
    </div>
</div>
@endsection

@push('scripts')
<script>
// Registered per brain/06-ui-conventions.md §5: "Components are declared in
// resources/js/alpine/*.js and registered with Alpine.data('posCart', …)." Inlined here for
// scaffold self-containment; move verbatim to resources/js/alpine/pos-cart.js on the real
// skeleton and drop this <script> block for a vite entry instead.
document.addEventListener('alpine:init', () => {
    Alpine.data('posCart', () => ({
        // ---- state shape matches brain/06 §5 exactly ----
        customer: null,
        prescription: null,
        lines: [],
        billDiscountPercent: 0,
        payments: [],
        totals: { subtotal: null, discount: null, gst: null, round_off: null, total: null },
        ui: {
            focusedLine: 0,
            searchOpen: false,
            paymentOpen: false,
            saving: false,
            quoting: false,
            searchTerm: '',
            searchResults: [],
            searchHighlight: 0,
            helpOpen: false,
            barcodeBuffer: '',
            barcodeLastKeyAt: 0,
            customerModalOpen: false,
            customerPhoneQuery: '',
            customerResults: [],
            customerSearching: false,
            customerQuickAdd: { name: '', phone: '' },
            customerQuickAddSaving: false,
            customerQuickAddError: null,
        },
        heldSlots: [],

        init() {
            this.refreshHeldSlots();
        },

        // ---- keyboard contract (brain/06 §2) ----
        // Function keys are captured with preventDefault() only here, and only for the keys
        // listed in the contract table — everything else uses browser defaults.
        handleKey(e) {
            // Barcode-as-keyboard: 8+ digit burst under 100ms/char terminated by Enter,
            // regardless of focused field (T-0401e).
            if (/^[0-9]$/.test(e.key)) {
                const now = performance.now();
                if (now - this.ui.barcodeLastKeyAt > 100) {
                    this.ui.barcodeBuffer = '';
                }
                this.ui.barcodeBuffer += e.key;
                this.ui.barcodeLastKeyAt = now;
            } else if (e.key === 'Enter' && this.ui.barcodeBuffer.length >= 8) {
                e.preventDefault();
                const code = this.ui.barcodeBuffer;
                this.ui.barcodeBuffer = '';
                this.resolveBarcode(code);
                return;
            } else if (e.key !== 'Shift') {
                this.ui.barcodeBuffer = '';
            }

            switch (e.key) {
                case 'F1':
                    e.preventDefault();
                    this.ui.helpOpen = !this.ui.helpOpen;
                    break;
                case 'F2':
                    e.preventDefault();
                    this.openCustomerModal();
                    break;
                case 'F3':
                    e.preventDefault();
                    this.clearSearch();
                    this.$refs.search?.focus();
                    break;
                case 'F4':
                    if (this.lines.length > 0) {
                        e.preventDefault();
                        this.ui.paymentOpen = true;
                    }
                    break;
                case 'F8':
                    if (this.ui.paymentOpen) {
                        e.preventDefault();
                        this.cyclePaymentMode();
                    }
                    break;
                case 'F9':
                    if (this.lines.length > 0) {
                        e.preventDefault();
                        this.holdBill();
                    }
                    break;
                case 'F10':
                    e.preventDefault();
                    this.recallBill();
                    break;
                case '+':
                    if (this.lines[this.ui.focusedLine]) {
                        e.preventDefault();
                        this.adjustQuantity(this.ui.focusedLine, 1);
                    }
                    break;
                case '-':
                    if (this.lines[this.ui.focusedLine]) {
                        e.preventDefault();
                        this.adjustQuantity(this.ui.focusedLine, -1);
                    }
                    break;
                case 'Delete':
                    if (e.ctrlKey && this.lines[this.ui.focusedLine]) {
                        e.preventDefault();
                        if (confirm('Remove this line from the bill? This cannot be undone from here.')) {
                            this.removeLine(this.ui.focusedLine);
                        }
                    }
                    break;
                case 'd':
                case 'D':
                    if (e.ctrlKey && this.lines.length > 0) {
                        e.preventDefault();
                        this.focusBillDiscount();
                    }
                    break;
                case 'p':
                case 'P':
                    if (e.ctrlKey) {
                        e.preventDefault();
                        this.reprintLast();
                    }
                    break;
            }
        },

        // ---- search ----
        onSearchInput() {
            if (this.ui.searchTerm.length < 3) {
                this.ui.searchResults = [];
                return;
            }
            window.posApi.get('/api/pos/medicines', { q: this.ui.searchTerm }).then((results) => {
                this.ui.searchResults = results;
                this.ui.searchHighlight = 0; // first result pre-highlighted
                this.ui.searchOpen = results.length > 0;
            });
        },
        moveSearchHighlight(delta) {
            if (!this.ui.searchResults.length) return;
            const max = this.ui.searchResults.length - 1;
            this.ui.searchHighlight = Math.min(max, Math.max(0, this.ui.searchHighlight + delta));
        },
        onSearchEnter() {
            const picked = this.ui.searchResults[this.ui.searchHighlight];
            if (picked) this.addMedicineToCart(picked);
        },
        clearSearch() {
            this.ui.searchTerm = '';
            this.ui.searchResults = [];
            this.ui.searchOpen = false;
        },
        resolveBarcode(code) {
            window.posApi.get(`/api/pos/barcode/${encodeURIComponent(code)}`).then((medicine) => {
                if (medicine) this.addMedicineToCart(medicine);
            });
        },

        addMedicineToCart(medicine) {
            this.lines.push({
                key: 'l' + Date.now() + Math.random().toString(36).slice(2, 6),
                medicine: {
                    id: medicine.id,
                    name: medicine.name,
                    is_prescription_required: medicine.is_prescription_required,
                    gst_rate: medicine.gst_rate,
                    unit: medicine.unit,
                },
                allocations: [],       // filled by the next quote — FEFO is never client-decided
                quantity: 1,
                unit_price_preview: medicine.selling_price_preview ?? null, // display only
                discount_percent: 0,
                line_total: null,
                gst_amount: null,
                warnings: [],
                prescriptionSatisfied: false,
            });
            this.ui.focusedLine = this.lines.length - 1;
            this.clearSearch();
            this.$refs.search?.focus();
            this.requote();
        },

        adjustQuantity(index, delta) {
            const line = this.lines[index];
            if (!line) return;
            const next = line.quantity + delta;
            if (next <= 0) {
                if (confirm('Remove this line from the bill?')) this.removeLine(index);
                return;
            }
            line.quantity = next;
            this.requote();
        },
        removeLine(index) {
            this.lines.splice(index, 1);
            this.ui.focusedLine = Math.max(0, this.ui.focusedLine - 1);
            this.requote();
        },

        // ---- server-authoritative quote (preview only, see top-of-file comment) ----
        requote() {
            this.ui.quoting = true;
            window.posApi.post('/api/pos/quote', {
                lines: this.lines,
                customer_id: this.customer?.id ?? null,
                bill_discount_percent: this.billDiscountPercent,
            }).then((quote) => {
                this.totals = quote.totals;
                quote.lines.forEach((quoted, i) => {
                    if (this.lines[i]) {
                        this.lines[i].allocations = quoted.allocations;
                        this.lines[i].line_total = quoted.line_total;
                        this.lines[i].gst_amount = quoted.gst_amount;
                        this.lines[i].warnings = quoted.warnings;
                    }
                });
            }).finally(() => { this.ui.quoting = false; });
        },

        // ---- hold / recall — Phase 4 session/cache-backed approach, see
        // App\Http\Controllers\PosController::hold()/recall() for the schema note ----
        holdBill(slot = null) {
            // F9 (no slot chosen) auto-picks the first free chip 1-9; the chip buttons pass
            // their own slot number directly — no window.prompt() either path (real UI now).
            if (slot === null) {
                slot = Array.from({ length: 9 }, (_, i) => i + 1).find((s) => !this.heldSlots.includes(s));
                if (!slot) { alert('All 9 hold slots are full.'); return; }
            }
            window.posApi.post('/api/pos/held-bills', { slot: Number(slot), cart: this.snapshotCart() })
                .then(() => { this.resetCart(); this.refreshHeldSlots(); this.$refs.search?.focus(); });
        },
        recallBill(slot = null) {
            // F10 (no slot chosen) auto-picks the oldest-numbered held chip.
            if (slot === null) {
                slot = this.heldSlots[0];
                if (!slot) { alert('No held bills to recall.'); return; }
            }
            window.posApi.get(`/api/pos/held-bills/${Number(slot)}`).then((res) => {
                this.customer = res.cart.customer;
                this.prescription = res.cart.prescription;
                this.lines = res.cart.lines;
                this.billDiscountPercent = res.cart.billDiscountPercent;
                this.payments = res.cart.payments;
                this.refreshHeldSlots();
                // Forced re-quote — prices/stock may have moved while held.
                this.requote();
            });
        },
        refreshHeldSlots() {
            window.posApi.get('/api/pos/held-bills').then((res) => { this.heldSlots = res.held_slots ?? []; });
        },
        snapshotCart() {
            // Exactly the documented shape minus `ui` (brain/06 §5).
            return {
                customer: this.customer,
                prescription: this.prescription,
                lines: this.lines,
                billDiscountPercent: this.billDiscountPercent,
                payments: this.payments,
                totals: this.totals,
            };
        },
        resetCart() {
            this.customer = null;
            this.prescription = null;
            this.lines = [];
            this.billDiscountPercent = 0;
            this.payments = [];
            this.totals = { subtotal: null, discount: null, gst: null, round_off: null, total: null };
            this.ui.paymentOpen = false;
        },

        // ---- payment panel plumbing (see pos/_payment-panel.blade.php) ----
        cyclePaymentMode() {
            const order = ['cash', 'card', 'upi', 'credit'];
            const current = this.payments[0]?.mode ?? 'cash';
            const next = order[(order.indexOf(current) + 1) % order.length];
            if (this.payments.length === 0) this.payments.push({ mode: next, amount: this.totals.total ?? '0.00', reference: null });
            else this.payments[0].mode = next;
        },

        // ---- F2 customer modal — replaces the old dead stub ----
        openCustomerModal() {
            this.ui.customerModalOpen = true;
            this.ui.customerPhoneQuery = '';
            this.ui.customerResults = [];
            this.ui.customerQuickAddError = null;
            this.$nextTick(() => this.$refs.customerPhoneSearch?.focus());
        },
        closeCustomerModal() {
            this.ui.customerModalOpen = false;
        },
        searchCustomers() {
            const phone = this.ui.customerPhoneQuery.trim();
            if (!phone) {
                this.ui.customerResults = [];
                return;
            }
            this.ui.customerSearching = true;
            window.posApi.get('/api/pos/customers/search', { phone })
                .then((res) => { this.ui.customerResults = res.customers ?? []; })
                .finally(() => { this.ui.customerSearching = false; });
        },
        selectCustomer(result) {
            this.customer = result;
            this.closeCustomerModal();
        },
        clearCustomer() {
            this.customer = null;
            this.closeCustomerModal();
        },
        quickCreateCustomer() {
            if (this.ui.customerQuickAddSaving || !this.ui.customerQuickAdd.name) return;
            this.ui.customerQuickAddSaving = true;
            this.ui.customerQuickAddError = null;
            window.posApi.post('/api/pos/customers', {
                name: this.ui.customerQuickAdd.name,
                phone: this.ui.customerQuickAdd.phone || null,
            }).then((res) => {
                this.customer = res;
                this.ui.customerQuickAdd = { name: '', phone: '' };
                this.closeCustomerModal();
            }).catch((err) => {
                this.ui.customerQuickAddError = err?.message ?? 'Could not create customer.';
            }).finally(() => {
                this.ui.customerQuickAddSaving = false;
            });
        },
        focusBillDiscount() { this.$refs.billDiscount?.focus(); this.$refs.billDiscount?.select(); },
        reprintLast() {
            if (window.posLastInvoiceUrl) window.open(window.posLastInvoiceUrl, '_blank');
        },

        expiryClass(expiryDateIso) {
            // Colour rules, brain/06 §3. Server also enforces the hard block (DR-EXP-02) —
            // this classifies only what the server already allowed through.
            const days = Math.floor((new Date(expiryDateIso) - new Date()) / 86400000);
            if (days <= 0) return 'text-red-800 line-through';
            if (days <= 90) return 'text-amber-800';
            return 'text-slate-600';
        },

        // ---- save ----
        async saveSale() {
            if (this.ui.saving) return;

            // Prescription hard-stop, UI-side convenience only — the server (T-0404a) refuses
            // regardless of what this check does.
            const unsatisfied = this.lines.find(
                (l) => l.medicine.is_prescription_required && !l.prescriptionSatisfied && !this.prescription
            );
            if (unsatisfied) {
                alert('A prescription-required item is on the bill. Enter a prescription number or use the pharmacist override before saving.');
                return;
            }

            this.ui.saving = true;
            try {
                const res = await window.posApi.post('/pos', {
                    lines: this.lines,
                    customer_id: this.customer?.id ?? null,
                    prescription: this.prescription,
                    payments: this.payments,
                    bill_discount_percent: this.billDiscountPercent,
                });
                window.posLastInvoiceUrl = res.print_a4_url;
                window.open(res.print_80mm_url, '_blank');
                this.resetCart();
                this.$refs.search?.focus();
            } catch (err) {
                // window.posApi maps 422 error_code -> readable message per
                // brain/04-coding-standards.md; surfaced inline, not as a page reload.
                alert(err.message ?? 'Could not save the sale.');
            } finally {
                this.ui.saving = false;
            }
        },
    }));
});
</script>
@endpush
