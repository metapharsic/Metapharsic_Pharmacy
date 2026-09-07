<x-app-layout>
    <x-slot name="header">
        <x-page-header :title="'Edit medicine'" :breadcrumbs="[
            ['label' => 'Medicines', 'href' => route('medicines.index')],
            ['label' => $medicine->name],
        ]" />
    </x-slot>

    @if ($errors->any())
        <div class="max-w-2xl mb-4 rounded-md bg-red-50 border border-red-300 p-4" aria-live="assertive">
            <p class="text-sm font-medium text-red-800">Please fix the following:</p>
            <ul class="mt-2 text-sm text-red-700 list-disc list-inside">
                @foreach ($errors->all() as $error)
                    <li><a href="#" class="hover:underline">{{ $error }}</a></li>
                @endforeach
            </ul>
        </div>
    @endif

    <form method="POST" action="{{ route('medicines.update', $medicine) }}"
          x-data="{ submitting: false }" @submit="submitting = true">
        @csrf
        @method('PUT')
        @include('medicines._form', ['medicine' => $medicine])

        <div class="max-w-2xl mt-6 flex justify-between items-center">
            @can('medicine.delete')
                <button type="button"
                        x-data
                        @click="$dispatch('open-confirm', {
                            message: 'This will deactivate {{ $medicine->name }}. It will no longer appear in search or the POS. This can be undone by an admin.',
                            action: '{{ route('medicines.destroy', $medicine) }}',
                        })"
                        class="text-sm font-medium text-red-600 hover:text-red-800">
                    Deactivate
                </button>
            @else
                <span></span>
            @endcan

            <div class="flex gap-3">
                <a href="{{ route('medicines.index') }}" class="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900">Cancel</a>
                <button type="submit" :disabled="submitting"
                        class="inline-flex items-center px-4 py-2 bg-brand-600 border border-transparent rounded-md text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50">
                    Save changes
                </button>
            </div>
        </div>
    </form>

    {{-- Batches and Opening Stock Section (Section 6 & 7 of Architecture) --}}
    <div class="max-w-2xl mt-10 space-y-6">
        {{-- Existing Batches Table --}}
        <div class="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
            <div class="flex items-center justify-between border-b border-slate-200 pb-3 mb-4">
                <div>
                    <h3 class="text-base font-bold text-slate-900">Active Medicine Batches</h3>
                    <p class="text-xs text-slate-500">FEFO priority: batches are sold in order of earliest expiry date.</p>
                </div>
                <span class="rounded bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-700 font-mono">
                    {{ $medicine->batches->count() }} Batches Total
                </span>
            </div>

            <div class="overflow-x-auto">
                <table class="w-full text-left text-xs">
                    <thead class="bg-slate-50 text-slate-600 uppercase tracking-wider text-[11px]">
                        <tr>
                            <th class="px-3 py-2">Batch Number</th>
                            <th class="px-3 py-2">Expiry Date</th>
                            <th class="px-3 py-2 text-right">Purchase Price</th>
                            <th class="px-3 py-2 text-right">Selling Price</th>
                            <th class="px-3 py-2 text-right">Available Qty</th>
                            <th class="px-3 py-2 text-center">Status</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-slate-100">
                        @forelse ($medicine->batches as $batch)
                            <tr class="hover:bg-slate-50/50">
                                <td class="px-3 py-2 font-mono font-bold text-slate-900">#{{ $batch->batch_no }}</td>
                                <td class="px-3 py-2 text-slate-600">{{ $batch->expiry_date?->format('d/m/Y') }}</td>
                                <td class="px-3 py-2 text-right font-mono text-slate-600">₹{{ number_format((float) $batch->purchase_price, 2) }}</td>
                                <td class="px-3 py-2 text-right font-mono font-semibold text-slate-900">₹{{ number_format((float) $batch->selling_price, 2) }}</td>
                                <td class="px-3 py-2 text-right font-bold text-emerald-700">{{ $batch->quantity_available }} {{ $medicine->unit }}</td>
                                <td class="px-3 py-2 text-center">
                                    <span class="rounded px-2 py-0.5 text-[10px] font-semibold {{ $batch->status->value === 'available' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-700' }}">
                                        {{ ucfirst($batch->status->value) }}
                                    </span>
                                </td>
                            </tr>
                        @empty
                            <tr>
                                <td colspan="6" class="px-3 py-4 text-center text-slate-400 italic">No batches recorded for this medicine yet.</td>
                            </tr>
                        @endforelse
                    </tbody>
                </table>
            </div>
        </div>

        {{-- Add Opening Stock Entry --}}
        @can('stock.adjust')
            <div class="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
                <div class="border-b border-slate-200 pb-3 mb-4">
                    <h3 class="text-base font-bold text-slate-900">Add Opening Stock Batch</h3>
                    <p class="text-xs text-slate-500">Creates an opening stock batch and appends a double-entry ledger transaction.</p>
                </div>

                <form method="POST" action="{{ route('medicines.opening-stock.store', $medicine) }}" class="space-y-4">
                    @csrf
                    <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div>
                            <label class="block text-xs font-semibold text-slate-700">Batch Number *</label>
                            <input type="text" name="batch_no" required placeholder="e.g. PCM-1001" class="mt-1 block w-full rounded border-slate-300 text-xs shadow-sm focus:border-brand-500 focus:ring-brand-500">
                        </div>

                        <div>
                            <label class="block text-xs font-semibold text-slate-700">Expiry Date *</label>
                            <input type="date" name="expiry_date" required min="{{ now()->addDay()->toDateString() }}" class="mt-1 block w-full rounded border-slate-300 text-xs shadow-sm focus:border-brand-500 focus:ring-brand-500">
                        </div>

                        <div>
                            <label class="block text-xs font-semibold text-slate-700">Quantity * ({{ $medicine->unit }})</label>
                            <input type="number" name="quantity" required min="1" placeholder="e.g. 50" class="mt-1 block w-full rounded border-slate-300 text-xs shadow-sm focus:border-brand-500 focus:ring-brand-500">
                        </div>

                        <div>
                            <label class="block text-xs font-semibold text-slate-700">Purchase Price (₹) *</label>
                            <input type="number" step="0.01" name="purchase_price" required min="0" value="{{ $medicine->default_purchase_price }}" class="mt-1 block w-full rounded border-slate-300 text-xs shadow-sm focus:border-brand-500 focus:ring-brand-500">
                        </div>

                        <div>
                            <label class="block text-xs font-semibold text-slate-700">Selling Price (₹) *</label>
                            <input type="number" step="0.01" name="selling_price" required min="0" value="{{ $medicine->default_selling_price }}" class="mt-1 block w-full rounded border-slate-300 text-xs shadow-sm focus:border-brand-500 focus:ring-brand-500">
                        </div>

                        <div>
                            <label class="block text-xs font-semibold text-slate-700">MRP (₹)</label>
                            <input type="number" step="0.01" name="mrp" min="0" value="{{ $medicine->default_selling_price }}" class="mt-1 block w-full rounded border-slate-300 text-xs shadow-sm focus:border-brand-500 focus:ring-brand-500">
                        </div>
                    </div>

                    <div class="flex justify-end pt-2">
                        <button type="submit" class="inline-flex items-center px-4 py-2 bg-emerald-600 border border-transparent rounded-md text-xs font-bold text-white hover:bg-emerald-700 shadow-sm">
                            + Add Opening Stock
                        </button>
                    </div>
                </form>
            </div>
        @endcan
    </div>

    {{-- x-confirm renders the consequence in words per brain/06 section 6; wired via a
         listen-for-event pattern rather than duplicating the dialog markup on every form. --}}
    <x-confirm />
</x-app-layout>
