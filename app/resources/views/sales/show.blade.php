{{--
    Invoice detail view. Cave law 2: cost columns explicitly excluded — this view never
    references cost_price_at_sale/effective_cost/purchase_price. Only report.profit-gated
    screens (Phase 5, admin only) may show cost, and those are stripped at the repository
    layer per DR-PROF-05, not merely hidden here.
--}}
@extends('layouts.app')

@section('content')
<x-page-header :title="'Invoice '.$sale->invoice_no" :breadcrumbs="[['label' => 'Sales', 'href' => route('sales.index')], ['label' => $sale->invoice_no]]">
    <x-slot name="action">
        <a href="{{ route('sales.invoice', $sale) }}" target="_blank" class="rounded border border-slate-300 px-3 py-1.5 text-sm">Print A4</a>
        <a href="{{ route('sales.receipt', $sale) }}" target="_blank" class="ml-2 rounded border border-slate-300 px-3 py-1.5 text-sm">Print 80mm</a>
        @can('sale.void', $sale)
            <form method="POST" action="{{ route('sales.void', $sale) }}" class="ml-2 inline">
                @csrf
                <button type="submit" class="rounded border border-red-300 px-3 py-1.5 text-sm text-red-700"
                    onclick="return confirm('Cancel invoice {{ $sale->invoice_no }}? This writes reversing stock transactions and cannot be undone.')">
                    Cancel sale
                </button>
            </form>
        @endcan
        @can('return.create')
            <a href="{{ route('returns.create', ['sale' => $sale->id]) }}" class="ml-2 rounded border border-slate-300 px-3 py-1.5 text-sm">Process return</a>
        @endcan
    </x-slot>
</x-page-header>

@if (session('status'))
    <div class="mb-4 rounded border border-ok-300 bg-ok-50 px-3 py-2 text-sm">{{ session('status') }}</div>
@endif
@if ($errors->any())
    <div class="mb-4 rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800" role="alert" aria-live="assertive">
        {{ $errors->first() }}
    </div>
@endif

<div class="mb-4 grid grid-cols-2 gap-4 text-sm">
    <div>
        <p><strong>Date:</strong> {{ $sale->sale_date->timezone('Asia/Kolkata')->format('d/m/Y H:i') }}</p>
        <p><strong>Cashier:</strong> {{ $sale->user->name ?? '—' }}</p>
        <p><strong>Customer:</strong> {{ $sale->customer->name ?? 'Walk-in' }}</p>
    </div>
    <div>
        <p><strong>Status:</strong> {{ $sale->status->value ?? $sale->status }}</p>
        <p><strong>Payment:</strong> {{ $sale->payment_status->value ?? $sale->payment_status }}</p>
        @if ($sale->requires_prescription)
            <p><strong>Prescription:</strong>
                {{ $sale->prescription->number ?? ($sale->rx_override_by ? 'Pharmacist override' : 'Missing') }}
            </p>
        @endif

        @if ($sale->prescription)
            @if ($sale->prescription->hasImage())
                <p class="mt-1 text-sm">
                    <a href="{{ route('sales.prescription-image.show', $sale) }}" target="_blank" class="rounded border border-slate-300 px-2 py-1 text-sm">View prescription image</a>
                    <span class="ml-2 text-sm text-slate-500">Uploaded {{ optional($sale->prescription->image_uploaded_at)->timezone('Asia/Kolkata')->format('d/m/Y H:i') }}</span>
                </p>
            @else
                @can('sale.view', $sale)
                    <form method="POST" action="{{ route('sales.prescription-image.store', $sale) }}" enctype="multipart/form-data" class="mt-1 text-sm">
                        @csrf
                        <label for="prescription-image-input" class="sr-only">Prescription image or scan</label>
                        <input id="prescription-image-input" type="file" name="image" aria-label="Prescription image or scan" accept="image/jpeg,image/png,application/pdf" class="text-sm">
                        <button type="submit" class="rounded border border-slate-300 px-2 py-1 text-sm">Upload</button>
                    </form>
                @endcan
            @endif
        @endif
    </div>
</div>

<table class="w-full text-left text-sm">
    <thead class="border-b border-slate-200">
        <tr>
            <th scope="col" class="px-2 py-2">Medicine</th>
            <th scope="col" class="px-2 py-2"><x-batch-badge /></th>
            <th scope="col" class="px-2 py-2 text-right">Qty</th>
            <th scope="col" class="px-2 py-2 text-right">Rate</th>
            <th scope="col" class="px-2 py-2 text-right">GST%</th>
            <th scope="col" class="px-2 py-2 text-right">Line Total</th>
            <th scope="col" class="px-2 py-2 text-right">Returned</th>
        </tr>
    </thead>
    <tbody>
        @foreach ($sale->items as $item)
            <tr class="border-b border-slate-100">
                <td class="px-2 py-2">
                    {{ $item->medicine->name }}
                    <x-rx-badge :required="$item->medicine->is_prescription_required" :satisfied="(bool) $sale->prescription || (bool) $sale->rx_override_by" />
                </td>
                <td class="px-2 py-2">{{ $item->batch->batch_no ?? $item->batch_no }} — {{ optional($item->expiry_date)->format('m/y') }}</td>
                <td class="px-2 py-2 text-right tabular-nums">{{ $item->quantity }}</td>
                <td class="px-2 py-2 text-right tabular-nums"><x-money :value="$item->unit_price" /></td>
                <td class="px-2 py-2 text-right tabular-nums">{{ $item->gst_rate }}%</td>
                <td class="px-2 py-2 text-right tabular-nums"><x-money :value="$item->line_total" /></td>
                <td class="px-2 py-2 text-right tabular-nums">{{ $item->returned_quantity ?? 0 }}</td>
            </tr>
        @endforeach
    </tbody>
</table>

<div class="mt-4 flex justify-end">
    <div class="w-64 text-sm">
        <div class="flex justify-between"><span>Subtotal</span><x-money :value="$sale->subtotal" /></div>
        <div class="flex justify-between"><span>Discount</span><x-money :value="$sale->discount_amount" /></div>
        <div class="flex justify-between"><span>GST</span><x-money :value="$sale->gst_amount" /></div>
        <div class="flex justify-between"><span>Round-off</span><x-money :value="$sale->round_off" /></div>
        <div class="flex justify-between text-lg font-semibold"><span>Total</span><x-money :value="$sale->total" /></div>
    </div>
</div>
@endsection
