{{--
    Sales history. Cave law 2: cost columns are excluded here not just by omission from this
    template but because Sale::items() and the Sale query in SaleController::index() never
    select purchase_price/effective_cost/cost_price_at_sale in the first place — this view
    simply has nothing to render even if someone added a column carelessly, since the
    attribute would not be present on the model.
--}}
@extends('layouts.app')

@section('content')
<x-page-header :title="'Sales'" :breadcrumbs="[['label' => 'Sales']]" />

<x-data-table :rows="$sales" :columns="[
    'invoice_no' => 'Invoice No',
    'sale_date' => 'Date',
    'customer' => 'Customer',
    'total' => 'Total',
    'payment_status' => 'Payment',
    'status' => 'Status',
    'actions' => '',
]">
    @foreach ($sales as $sale)
        <tr class="border-t border-slate-100">
            <td class="px-3 py-2">
                <a href="{{ route('sales.show', $sale) }}" class="text-brand-700 underline">{{ $sale->invoice_no }}</a>
            </td>
            <td class="px-3 py-2">{{ $sale->sale_date->timezone('Asia/Kolkata')->format('d/m/Y H:i') }}</td>
            <td class="px-3 py-2">{{ $sale->customer->name ?? 'Walk-in' }}</td>
            <td class="px-3 py-2 text-right tabular-nums"><x-money :value="$sale->total" /></td>
            <td class="px-3 py-2">{{ $sale->payment_status->value ?? $sale->payment_status }}</td>
            <td class="px-3 py-2">
                <span class="{{ $sale->status->value === 'cancelled' ? 'text-red-700' : '' }}">
                    {{ $sale->status->value ?? $sale->status }}
                </span>
            </td>
            <td class="px-3 py-2 text-right">
                <a href="{{ route('sales.invoice', $sale) }}" class="text-sm text-brand-700 underline" target="_blank">Print</a>
                @can('sale.void', $sale)
                    <form method="POST" action="{{ route('sales.void', $sale) }}" class="inline">
                        @csrf
                        <button type="submit" class="ml-2 text-sm text-red-700 underline"
                            onclick="return confirm('Cancel invoice {{ $sale->invoice_no }}? This writes reversing stock transactions and cannot be undone.')">
                            Cancel
                        </button>
                    </form>
                @endcan
                @can('return.create')
                    <a href="{{ route('returns.create', ['sale' => $sale->id]) }}" class="ml-2 text-sm text-brand-700 underline">Return</a>
                @endcan
            </td>
        </tr>
    @endforeach
</x-data-table>

{{ $sales->links() }}
@endsection
