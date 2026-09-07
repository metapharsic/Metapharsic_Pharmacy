{{--
    Admin-only stock adjustment. Reason is mandatory and comes from a fixed
    enum (DR-ADJ-02) — no free-text "other". The dropdown is UI convenience
    only; StoreStockAdjustmentRequest re-validates the value server-side.
--}}
<x-app-layout>
    <x-page-header :title="'Stock Adjustment'" :breadcrumbs="[
        ['label' => 'Inventory', 'href' => route('inventory.index')],
        ['label' => 'Adjustment'],
    ]" />

    <div class="mx-auto max-w-2xl px-4 py-6"
         x-data="{ reason: '', requiresNote() { return ['damaged', 'theft'].includes(this.reason); } }">
        <form method="POST" action="{{ route('stock-adjustments.store') }}">
            @csrf

            <x-card class="space-y-4">
                <x-form.select
                    name="medicine_batch_id"
                    label="Batch"
                    :options="$batches->mapWithKeys(fn ($b) => [$b->id => \"{$b->medicine->name} — {$b->batch_no} (exp {$b->expiry_date->format('m/y')}, qty {$b->quantity_available})\"])"
                />

                <x-form.select
                    name="reason"
                    label="Reason"
                    x-model="reason"
                    :options="collect($reasons)->mapWithKeys(fn ($r) => [$r->value => ucfirst(str_replace('_', ' ', $r->value))])"
                />

                <x-form.input
                    name="quantity_change"
                    type="number"
                    label="Quantity change"
                />

                <x-form.textarea
                    name="note"
                    label="Note"
                    x-bind:required="requiresNote()"
                />
            </x-card>

            <div class="mt-6 flex justify-end gap-3">
                <a href="{{ route('inventory.index') }}" class="rounded-md border border-slate-300 px-4 py-2 text-sm">Cancel</a>
                <button type="submit" class="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">
                    Save Adjustment
                </button>
            </div>
        </form>
    </div>
</x-app-layout>
