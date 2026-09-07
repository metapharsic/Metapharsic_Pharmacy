{{--
    Payment panel (F4 to open) — brain/06-ui-conventions.md §2, §5.
    Displayed amounts are the last server quote (totals.total); the amount actually charged
    is recomputed again server-side inside SalesService::createSale() — see the cave-law
    comment at the top of pos/index.blade.php.
--}}
<div class="rounded border border-slate-300 bg-white p-4" role="dialog" aria-label="Payment">
    <h2 class="mb-3 text-lg font-semibold">Payment — Total ₹<span x-text="totals.total ?? '0.00'"></span></h2>

    <div class="mb-3 grid grid-cols-4 gap-2">
        <button type="button"
            class="rounded border px-2 py-2 text-sm"
            :class="payments[0]?.mode === 'cash' ? 'border-brand-600 bg-brand-50' : 'border-slate-300'"
            @click="payments = [{ mode: 'cash', amount: totals.total ?? '0.00', reference: null }]"
        >Cash</button>
        <button type="button"
            class="rounded border px-2 py-2 text-sm"
            :class="payments[0]?.mode === 'card' ? 'border-brand-600 bg-brand-50' : 'border-slate-300'"
            @click="payments = [{ mode: 'card', amount: totals.total ?? '0.00', reference: '' }]"
        >Card</button>
        <button type="button"
            class="rounded border px-2 py-2 text-sm"
            :class="payments[0]?.mode === 'upi' ? 'border-brand-600 bg-brand-50' : 'border-slate-300'"
            @click="payments = [{ mode: 'upi', amount: totals.total ?? '0.00', reference: '' }]"
        >UPI</button>
        <button type="button"
            class="rounded border px-2 py-2 text-sm"
            :class="(customer && customer.blocked) ? 'cursor-not-allowed border-slate-200 text-slate-300' : 'border-slate-300'"
            :disabled="!customer || customer.blocked"
            @click="payments = [{ mode: 'credit', amount: totals.total ?? '0.00', reference: null }]"
        >Credit</button>
    </div>

    <template x-if="customer && customer.blocked">
        <p class="mb-3 rounded border border-red-300 bg-red-100 px-2 py-1 text-sm text-red-800">
            Credit blocked — outstanding ₹<span x-text="customer.outstanding"></span> of ₹<span x-text="customer.credit_limit"></span> limit.
            Requires an admin override (customer.credit_override) — not available from this screen.
        </p>
    </template>

    <div class="mb-3">
        <button type="button" class="text-sm text-brand-700 underline" @click="payments.push({ mode: 'cash', amount: '0.00', reference: null })">
            + Split payment
        </button>
        <template x-for="(p, i) in payments" :key="i">
            <div class="mt-2 flex items-center gap-2" x-show="payments.length > 1">
                <select x-model="p.mode" class="rounded border border-slate-300 px-2 py-1">
                    <option value="cash">Cash</option>
                    <option value="card">Card</option>
                    <option value="upi">UPI</option>
                    <option value="credit">Credit</option>
                </select>
                <input type="text" x-model="p.amount" inputmode="decimal" class="w-28 rounded border border-slate-300 px-2 py-1 text-right tabular-nums" aria-label="Amount">
                <button type="button" class="text-slate-400 hover:text-red-600" @click="payments.splice(i, 1)" aria-label="Remove payment row">✕</button>
            </div>
        </template>
        <p class="mt-1 text-xs text-slate-400" x-show="payments.length > 1">
            Split amounts must sum exactly to the total — the server rejects a mismatch with a 422.
        </p>
    </div>

    <button
        type="button"
        class="w-full rounded bg-brand-600 py-3 text-lg font-semibold text-white disabled:opacity-50"
        :disabled="ui.saving || payments.length === 0"
        @click="saveSale()"
    >
        <span x-show="!ui.saving">Save &amp; Print (Enter)</span>
        <span x-show="ui.saving">Saving…</span>
    </button>
</div>
