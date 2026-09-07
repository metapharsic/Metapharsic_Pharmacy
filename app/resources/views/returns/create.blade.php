{{--
    Pick a sale, then process a return against it. DR-RET-01/02: every return line must
    reference an original sale_item, and quantity is capped at
    sale_item.quantity - sale_item.returned_quantity. The cap enforced by the max attribute
    here is UI convenience only — StoreReturnRequest and ReturnService::processReturn() both
    re-check server-side against a row read for update (brain/03 §1 cave law).
--}}
@extends('layouts.app')

@section('content')
<x-page-header :title="'Process return'" :breadcrumbs="[['label' => 'Sales', 'href' => route('sales.index')], ['label' => 'Process Return']]" />

@if (! $sale)
    <form method="GET" action="{{ route('returns.create') }}" class="max-w-md">
        <x-form.input name="invoice_no" label="Invoice number" hint="Enter the invoice number to look up the sale." autofocus />
        <button type="submit" class="mt-3 rounded bg-brand-600 px-4 py-2 text-white">Find sale</button>
    </form>
@else
    <form method="POST" action="{{ route('returns.store') }}" x-data="returnForm()">
        @csrf
        <input type="hidden" name="sale_id" value="{{ $sale->id }}">

        <p class="mb-3 text-sm text-slate-500">
            Invoice {{ $sale->invoice_no }} — {{ $sale->sale_date->timezone('Asia/Kolkata')->format('d/m/Y') }} —
            {{ $sale->customer->name ?? 'Walk-in' }}
        </p>

        <table class="w-full text-left text-sm">
            <thead class="border-b border-slate-200">
                <tr>
                    <th scope="col" class="px-2 py-2"></th>
                    <th scope="col" class="px-2 py-2">Medicine</th>
                    <th scope="col" class="px-2 py-2">Batch</th>
                    <th scope="col" class="px-2 py-2 text-right">Sold</th>
                    <th scope="col" class="px-2 py-2 text-right">Already returned</th>
                    <th scope="col" class="px-2 py-2 text-right">Remaining</th>
                    <th scope="col" class="px-2 py-2 text-right">Return qty</th>
                    <th scope="col" class="px-2 py-2">Condition</th>
                </tr>
            </thead>
            <tbody>
                @foreach ($sale->items as $i => $item)
                    @php $remaining = $item->quantity - ($item->returned_quantity ?? 0); @endphp
                    <tr class="border-b border-slate-100 {{ $remaining <= 0 ? 'text-slate-300' : '' }}">
                        <td class="px-2 py-2">
                            @if ($remaining > 0)
                                <input type="checkbox" name="lines[{{ $i }}][sale_item_id]" value="{{ $item->id }}" aria-label="Include line">
                            @endif
                        </td>
                        <td class="px-2 py-2">{{ $item->medicine->name }}</td>
                        <td class="px-2 py-2">{{ $item->batch->batch_no ?? $item->batch_no }}</td>
                        <td class="px-2 py-2 text-right tabular-nums">{{ $item->quantity }}</td>
                        <td class="px-2 py-2 text-right tabular-nums">{{ $item->returned_quantity ?? 0 }}</td>
                        <td class="px-2 py-2 text-right tabular-nums">{{ $remaining }}</td>
                        <td class="px-2 py-2 text-right">
                            <input
                                type="number"
                                name="lines[{{ $i }}][quantity]"
                                min="1"
                                max="{{ $remaining }}"
                                value="{{ $remaining > 0 ? 1 : 0 }}"
                                {{ $remaining <= 0 ? 'disabled' : '' }}
                                class="w-20 rounded border border-slate-300 px-2 py-1 text-right tabular-nums"
                                aria-label="Return quantity"
                            >
                        </td>
                        <td class="px-2 py-2">
                            <select name="lines[{{ $i }}][condition]" class="rounded border border-slate-300 px-2 py-1" {{ $remaining <= 0 ? 'disabled' : '' }}>
                                <option value="good">Good — restock</option>
                                <option value="damaged">Damaged — quarantine</option>
                                <option value="expired">Expired — quarantine</option>
                            </select>
                        </td>
                    </tr>
                @endforeach
            </tbody>
        </table>

        <div class="mt-4 max-w-md">
            <x-form.textarea name="reason" label="Reason" hint="Optional, but recommended for the audit trail." />
        </div>

        <button type="submit" class="mt-4 rounded bg-brand-600 px-4 py-2 text-white">Process return</button>
    </form>
@endif
@endsection
