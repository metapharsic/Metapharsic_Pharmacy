<x-app-layout>
    <x-page-header :title="'Purchase '.$purchase->invoice_no" :breadcrumbs="[
        ['label' => 'Purchases', 'href' => route('purchases.index')],
        ['label' => $purchase->invoice_no],
    ]">
        <x-slot name="action">
            @if ($purchase->status->value === 'draft')
                @can('purchase.confirm')
                    <x-confirm
                        :message="'Confirm this purchase? Stock will be received and the supplier balance updated immediately.'"
                        :action="route('purchases.confirm', $purchase)"
                    >
                        <button type="button" class="inline-flex items-center rounded-md bg-ok-600 px-4 py-2 text-sm font-medium text-white hover:bg-ok-700">
                            Confirm
                        </button>
                    </x-confirm>
                @endcan
            @endif

            @if (in_array($purchase->status->value, ['draft', 'confirmed'], true))
                @can('purchase.cancel')
                    <x-confirm
                        :message="'Cancel this purchase? If it was confirmed, reversing stock movements will be recorded — nothing is deleted.'"
                        :action="route('purchases.cancel', $purchase)"
                        :danger="true"
                    >
                        <button type="button" class="ml-2 inline-flex items-center rounded-md bg-danger-600 px-4 py-2 text-sm font-medium text-white hover:bg-danger-700">
                            Cancel
                        </button>
                    </x-confirm>
                @endcan
            @endif
        </x-slot>
    </x-page-header>

    <div class="mx-auto max-w-6xl px-4 py-6 space-y-6">
        @if (session('status'))
            <div class="rounded-md bg-ok-50 px-4 py-3 text-sm text-ok-800" aria-live="polite">{{ session('status') }}</div>
        @endif

        <x-card>
            <dl class="grid grid-cols-2 gap-4 sm:grid-cols-4 text-sm">
                <div>
                    <dt class="text-slate-500">Supplier</dt>
                    <dd class="font-medium">{{ $purchase->supplier->name }}</dd>
                </div>
                <div>
                    <dt class="text-slate-500">Invoice Date</dt>
                    <dd class="font-medium">{{ $purchase->invoice_date->format('d/m/Y') }}</dd>
                </div>
                <div>
                    <dt class="text-slate-500">Status</dt>
                    <dd>
                        @if ($purchase->status->value === 'draft')
                            <span class="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700">Draft</span>
                        @elseif ($purchase->status->value === 'confirmed')
                            <span class="inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-800">Confirmed</span>
                        @else
                            <span class="inline-flex items-center rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-800">Cancelled</span>
                        @endif
                    </dd>
                </div>
            </dl>
        </x-card>

        <x-card>
            <table class="min-w-full divide-y divide-slate-200 text-sm">
                <thead class="text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                    <tr>
                        <th scope="col" class="px-2 py-2">Medicine</th>
                        <th scope="col" class="px-2 py-2">Batch</th>
                        <th scope="col" class="px-2 py-2">Expiry</th>
                        <th scope="col" class="px-2 py-2">Qty</th>
                        <th scope="col" class="px-2 py-2">Free</th>
                        <th scope="col" class="px-2 py-2">Purchase Price</th>
                        <th scope="col" class="px-2 py-2">GST %</th>
                    </tr>
                </thead>
                <tbody>
                    @foreach ($purchase->items as $item)
                        <tr class="border-t border-slate-100">
                            <td class="px-2 py-2">{{ $item->medicine->name }}</td>
                            <td class="px-2 py-2">{{ $item->batch_no }}</td>
                            <td class="px-2 py-2"><x-expiry-pill :date="$item->expiry_date" /></td>
                            <td class="px-2 py-2 tabular-nums">{{ $item->quantity }}</td>
                            <td class="px-2 py-2 tabular-nums">
                                {{ $item->free_quantity }}
                                @if ($item->free_quantity > 0)
                                    <span class="ml-1 rounded bg-slate-100 px-1 text-xs text-slate-600">FREE</span>
                                @endif
                            </td>
                            <td class="px-2 py-2 tabular-nums"><x-money :value="$item->purchase_price" /></td>
                            <td class="px-2 py-2 tabular-nums">{{ $item->gst_rate }}%</td>
                        </tr>
                    @endforeach
                </tbody>
            </table>
        </x-card>
    </div>
</x-app-layout>
