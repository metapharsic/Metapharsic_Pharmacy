{{--
    Dynamic purchase line items via Alpine. The running subtotal shown here
    is client-side UX only — it is never sent to the server and never
    trusted. StorePurchaseRequest re-validates every field, and
    PurchaseService recomputes effective_cost server-side (DR-FREE-03).
    See brain/06-ui-conventions.md §5: Alpine handles interaction, never the
    domain.
--}}
<x-app-layout>
    <x-page-header :title="'New Purchase'" :breadcrumbs="[
        ['label' => 'Purchases', 'href' => route('purchases.index')],
        ['label' => 'New'],
    ]" />

    <div class="mx-auto max-w-6xl px-4 py-6"
         x-data="purchaseForm({
            medicines: @js($medicines ?? []),
            items: [{ medicine_id: '', batch_no: '', expiry_date: '', quantity: 1, free_quantity: 0, purchase_price: '0.00', mrp: '0.00', selling_price: '0.00', gst_rate: 12, discount_percent: 0 }]
         })">
        <form method="POST" action="{{ route('purchases.store') }}">
            @csrf

            <x-card class="mb-6">
                <div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    <x-form.select name="supplier_id" label="Supplier" :options="$suppliers->pluck('name', 'id')" />
                    <x-form.input name="invoice_no" label="Invoice No." />
                    <x-form.date name="invoice_date" label="Invoice Date" />
                </div>
            </x-card>

            <x-card>
                <table class="min-w-full divide-y divide-slate-200 text-sm">
                    <thead>
                        <tr class="text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                            <th class="px-2 py-2">Medicine</th>
                            <th class="px-2 py-2">Batch No.</th>
                            <th class="px-2 py-2">Expiry Date</th>
                            <th class="px-2 py-2">Qty</th>
                            <th class="px-2 py-2">Free Qty</th>
                            <th class="px-2 py-2">Purchase Price</th>
                            <th class="px-2 py-2">MRP</th>
                            <th class="px-2 py-2">Selling Price</th>
                            <th class="px-2 py-2">GST %</th>
                            <th class="px-2 py-2">Line Total</th>
                            <th class="px-2 py-2"></th>
                        </tr>
                    </thead>
                    <tbody>
                        <template x-for="(line, index) in items" :key="index">
                            <tr class="border-t border-slate-100">
                                <td class="px-2 py-1">
                                    <select :name="`items[${index}][medicine_id]`" x-model="line.medicine_id" @change="onMedicineChange(line)" class="w-48 rounded border-slate-300 text-sm">
                                        <option value="">Select Medicine…</option>
                                        <template x-for="med in medicines" :key="med.id">
                                            <option :value="med.id" x-text="`${med.name} (${med.unit || 'units'})`"></option>
                                        </template>
                                    </select>
                                </td>
                                <td class="px-2 py-1"><input :name="`items[${index}][batch_no]`" x-model="line.batch_no" placeholder="e.g. BATCH-01" class="w-28 rounded border-slate-300 text-sm" /></td>
                                <td class="px-2 py-1"><input type="date" :name="`items[${index}][expiry_date]`" x-model="line.expiry_date" class="w-36 rounded border-slate-300 text-sm" /></td>
                                <td class="px-2 py-1"><input type="number" min="1" :name="`items[${index}][quantity]`" x-model.number="line.quantity" @input="recalc()" class="w-20 rounded border-slate-300 text-sm tabular-nums" /></td>
                                <td class="px-2 py-1"><input type="number" min="0" :name="`items[${index}][free_quantity]`" x-model.number="line.free_quantity" @input="recalc()" class="w-20 rounded border-slate-300 text-sm tabular-nums" /></td>
                                <td class="px-2 py-1"><input type="number" step="0.01" min="0" :name="`items[${index}][purchase_price]`" x-model.number="line.purchase_price" @input="recalc()" class="w-24 rounded border-slate-300 text-sm tabular-nums" /></td>
                                <td class="px-2 py-1"><input type="number" step="0.01" min="0" :name="`items[${index}][mrp]`" x-model.number="line.mrp" class="w-24 rounded border-slate-300 text-sm tabular-nums" /></td>
                                <td class="px-2 py-1"><input type="number" step="0.01" min="0" :name="`items[${index}][selling_price]`" x-model.number="line.selling_price" class="w-24 rounded border-slate-300 text-sm tabular-nums" /></td>
                                <td class="px-2 py-1">
                                    <select :name="`items[${index}][gst_rate]`" x-model.number="line.gst_rate" @change="recalc()" class="w-20 rounded border-slate-300 text-sm">
                                        <option value="0">0%</option>
                                        <option value="5">5%</option>
                                        <option value="12">12%</option>
                                        <option value="18">18%</option>
                                    </select>
                                </td>
                                <td class="px-2 py-1 tabular-nums text-slate-600 font-medium" x-text="lineTotal(line)"></td>
                                <td class="px-2 py-1">
                                    <button type="button" @click="removeLine(index)" class="text-red-600 hover:text-red-800" aria-label="Remove line">✕</button>
                                </td>
                            </tr>
                        </template>
                    </tbody>
                </table>

                <button type="button" @click="addLine()" class="mt-3 rounded-md border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50">
                    + Add line
                </button>

                <div class="mt-4 flex justify-end text-sm">
                    <div class="w-64 space-y-1">
                        <div class="flex justify-between">
                            <span class="text-slate-500">Subtotal (indicative)</span>
                            <span class="tabular-nums font-semibold" x-text="'₹' + subtotal()"></span>
                        </div>
                        <p class="text-xs text-slate-400">Recomputed authoritatively on save.</p>
                    </div>
                </div>
            </x-card>

            <div class="mt-6 flex justify-end gap-3">
                <a href="{{ route('purchases.index') }}" class="rounded-md border border-slate-300 px-4 py-2 text-sm">Cancel</a>
                <button type="submit" class="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">
                    Save Draft
                </button>
            </div>
        </form>
    </div>

    @push('scripts')
        <script>
            function purchaseForm({ medicines, items }) {
                return {
                    medicines: medicines || [],
                    items: items || [],
                    addLine() {
                        this.items.push({ medicine_id: '', batch_no: '', expiry_date: '', quantity: 1, free_quantity: 0, purchase_price: '0.00', mrp: '0.00', selling_price: '0.00', gst_rate: 12, discount_percent: 0 });
                    },
                    removeLine(index) {
                        if (this.items.length > 1) this.items.splice(index, 1);
                    },
                    onMedicineChange(line) {
                        const med = this.medicines.find(m => m.id == line.medicine_id);
                        if (med && med.gst_rate !== undefined) {
                            line.gst_rate = Number(med.gst_rate);
                        }
                        this.recalc();
                    },
                    lineTotal(line) {
                        const gross = (Number(line.quantity) || 0) * (Number(line.purchase_price) || 0);
                        const gst = gross * ((Number(line.gst_rate) || 0) / 100);
                        return (gross + gst).toFixed(2);
                    },
                    subtotal() {
                        return this.items.reduce((sum, line) => sum + Number(this.lineTotal(line)), 0).toFixed(2);
                    },
                    recalc() {},
                };
            }
        </script>
    @endpush
</x-app-layout>
