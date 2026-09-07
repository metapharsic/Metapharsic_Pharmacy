{{--
    80mm thermal receipt — filename fixed per CONFLICT-003's resolution
    (resources/views/sales/print-80mm.blade.php). Rendered inside
    layouts/print-80mm.blade.php, which carries:
        @page { size: 80mm auto; margin: 2mm; }
    Monospace, condensed, no colour, no images beyond an optional 1-bit logo — brain/06 §7.
    Content order matches that section exactly.
--}}
@php
    $shopName = config('pharmacy.shop_name') ?? 'Not set';
    $shopAddress = config('pharmacy.shop_address') ?? 'Not set';
    $gstin = config('pharmacy.gstin') ?? 'Not set';
    $drugLicenceNo = config('pharmacy.drug_licence_no') ?? 'Not set';
    $bySlab = $sale->items->groupBy('gst_rate');
@endphp

<div class="receipt-80mm">
    <div class="center">{{ $shopName }}</div>
    <div class="center">{{ $shopAddress }}</div>
    <div class="center">GSTIN: {{ $gstin }}</div>
    <div class="center">DL No: {{ $drugLicenceNo }}</div>
    <hr>
    <div>Inv: {{ $sale->invoice_no }}</div>
    <div>{{ $sale->sale_date->timezone('Asia/Kolkata')->format('d/m/Y H:i') }}</div>
    <div>Cashier: {{ $sale->user->name ? \Illuminate\Support\Str::of($sale->user->name)->substr(0, 3)->upper() : '—' }}</div>
    <hr>

    @foreach ($sale->items as $item)
        <div class="line-item">
            {{ \Illuminate\Support\Str::limit($item->medicine->name, 28) }}
            @if ($item->medicine->is_prescription_required) [Rx] @endif
        </div>
        <div class="line-item right">
            {{ $item->quantity }} x {{ number_format((float) $item->unit_price, 2) }} = {{ number_format((float) $item->line_total, 2) }}
        </div>
    @endforeach
    <hr>

    @foreach ($bySlab as $rate => $items)
        <div class="line-item">
            GST {{ $rate }}%: Taxable {{ number_format((float) $items->sum('taxable_amount'), 2) }}
            CGST {{ number_format((float) $items->sum('cgst_amount'), 2) }}
            SGST {{ number_format((float) $items->sum('sgst_amount'), 2) }}
        </div>
    @endforeach
    <hr>

    <div class="right"><strong>TOTAL: {{ number_format((float) $sale->total, 2) }}</strong></div>
    @foreach ($sale->payments as $payment)
        <div class="right">{{ ucfirst($payment->mode->value ?? $payment->mode) }}: {{ number_format((float) $payment->amount, 2) }}</div>
    @endforeach
    <div class="right">Balance: {{ number_format((float) $sale->due, 2) }}</div>

    @if ($sale->requires_prescription && $sale->prescription)
        <hr>
        <div>Rx No: {{ $sale->prescription->number }}</div>
    @endif

    <div>Pharmacist: {{ $sale->pharmacist_name ?? 'Not set' }}</div>
    <hr>
    <div class="center">Thank you</div>
</div>
