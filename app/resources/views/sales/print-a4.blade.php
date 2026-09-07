{{--
    A4 tax invoice — brain/06-ui-conventions.md §7. Rendered inside layouts/print-a4.blade.php
    (no app chrome). GST breakup shown at SUMMARY level (per slab), per brain/06 §7's "GST
    breakup per slab" wording and DR-GST-11's reporting shape — not repeated per-line beyond
    the line's own gst_rate/gst_amount columns, to keep the line table readable.

    config/pharmacy.php is a NEW file this scaffold adds (drug_licence_no, gstin, shop_name,
    shop_address) — see that file's header comment. It needs merging into the real skeleton's
    config directory; until Q-003 (statutory footer strings) resolves, values default to null
    and render as "Not set" below rather than a blank line, so a missing legal field stays
    visibly missing.
--}}
@php
    $shopName = config('pharmacy.shop_name') ?? 'Not set';
    $shopAddress = config('pharmacy.shop_address') ?? 'Not set';
    $gstin = config('pharmacy.gstin') ?? 'Not set';
    $drugLicenceNo = config('pharmacy.drug_licence_no') ?? 'Not set';
@endphp

<div class="invoice">
    <header class="header">
        <h1>{{ $shopName }}</h1>
        <p>{{ $shopAddress }}</p>
        <p>GSTIN: {{ $gstin }} &nbsp; | &nbsp; Drug Licence No. (20B/21B): {{ $drugLicenceNo }}</p>
        <h2>TAX INVOICE</h2>
    </header>

    <section class="meta grid">
        <div>
            <p><strong>Invoice No:</strong> {{ $sale->invoice_no }}</p>
            <p><strong>Date:</strong> {{ $sale->sale_date->timezone('Asia/Kolkata')->format('d/m/Y H:i') }}</p>
            <p><strong>Cashier:</strong> {{ $sale->user->name ?? '—' }}</p>
        </div>
        <div>
            {{-- Cave law 2: nothing on this print view derives from cost_price_at_sale. --}}
            <p><strong>Pharmacist:</strong> {{ $sale->pharmacist_name ?? config('pharmacy.pharmacist_name', 'Not set') }}</p>
            <p><strong>Reg. No:</strong> {{ $sale->pharmacist_registration_no ?? 'Not set' }}</p>
        </div>
    </section>

    <section class="party">
        @if ($sale->customer)
            <p><strong>{{ $sale->customer->name }}</strong> &nbsp; {{ $sale->customer->phone }}</p>
            <p>{{ $sale->customer->address }}</p>
            @if ($sale->customer->doctor_name)
                <p>Doctor: {{ $sale->customer->doctor_name }}</p>
            @endif
            @if ($sale->customer->gstin)
                <p>Customer GSTIN: {{ $sale->customer->gstin }}</p>
            @endif
        @else
            <p>Walk-in customer</p>
        @endif
    </section>

    @if ($sale->requires_prescription)
        <section class="prescription">
            @if ($sale->prescription)
                <p><strong>Prescription No:</strong> {{ $sale->prescription->number }} &nbsp;
                   <strong>Doctor:</strong> {{ $sale->prescription->doctor_name }}</p>
            @endif
            @if ($sale->rx_override_by)
                <p><em>Prescription override recorded by {{ $sale->rxOverrideBy->name ?? 'user #'.$sale->rx_override_by }}
                   — reason: {{ $sale->rx_override_reason }}</em></p>
            @endif
        </section>
    @endif

    <table class="lines">
        <thead>
            <tr>
                <th>S.No</th>
                <th>Medicine</th>
                <th>HSN</th>
                <th>Batch</th>
                <th>Exp</th>
                <th>Pack</th>
                <th>Qty</th>
                <th>MRP</th>
                <th>Rate</th>
                <th>Disc</th>
                <th>Taxable</th>
                <th>GST%</th>
                <th>GST Amt</th>
                <th>Total</th>
            </tr>
        </thead>
        <tbody>
            @foreach ($sale->items as $i => $item)
                <tr class="line-item">
                    <td>{{ $i + 1 }}</td>
                    <td>
                        {{ $item->medicine->name }}
                        @if ($item->medicine->is_prescription_required) <span class="rx">℞</span> @endif
                    </td>
                    <td>{{ $item->hsn_code }}</td>
                    <td>{{ $item->batch->batch_no ?? $item->batch_no }}</td>
                    <td>{{ optional($item->expiry_date)->format('m/y') }}</td>
                    <td>{{ $item->medicine->unit ?? '' }}</td>
                    <td>{{ $item->quantity }}</td>
                    <td>{{ number_format((float) $item->mrp, 2) }}</td>
                    <td>{{ number_format((float) $item->unit_price, 2) }}</td>
                    <td>{{ number_format((float) $item->discount_amount, 2) }}</td>
                    <td>{{ number_format((float) $item->taxable_amount, 2) }}</td>
                    <td>{{ $item->gst_rate }}%</td>
                    <td>{{ number_format((float) $item->gst_amount, 2) }}</td>
                    <td>{{ number_format((float) $item->line_total, 2) }}</td>
                </tr>
            @endforeach
        </tbody>
    </table>

    {{-- GST summary per slab — CGST/SGST split, summary level (DR-GST-04/05/11) --}}
    @php
        $bySlab = $sale->items->groupBy('gst_rate');
    @endphp
    <table class="tax-summary">
        <thead>
            <tr>
                <th>Slab</th>
                <th>Taxable Value</th>
                <th>CGST</th>
                <th>SGST</th>
                <th>Total Tax</th>
            </tr>
        </thead>
        <tbody>
            @foreach ($bySlab as $rate => $items)
                <tr>
                    <td>{{ $rate }}%</td>
                    <td>{{ number_format((float) $items->sum('taxable_amount'), 2) }}</td>
                    <td>{{ number_format((float) $items->sum('cgst_amount'), 2) }}</td>
                    <td>{{ number_format((float) $items->sum('sgst_amount'), 2) }}</td>
                    <td>{{ number_format((float) $items->sum('gst_amount'), 2) }}</td>
                </tr>
            @endforeach
        </tbody>
    </table>
    {{-- IGST row intentionally absent — v1 is intra-state only, DR-GST-04/05. --}}

    <section class="totals">
        <p>Subtotal: {{ number_format((float) $sale->subtotal, 2) }}</p>
        <p>Discount: {{ number_format((float) $sale->discount_amount, 2) }}</p>
        <p>GST: {{ number_format((float) $sale->gst_amount, 2) }}</p>
        <p>Round-off: {{ number_format((float) $sale->round_off, 2) }}</p>
        <p class="grand"><strong>Grand Total: ₹{{ number_format((float) $sale->total, 2) }}</strong></p>
        <p class="words">{{ $sale->total_in_words ?? '' }}</p>
    </section>

    <section class="payment">
        @foreach ($sale->payments as $payment)
            <p>{{ ucfirst($payment->mode->value ?? $payment->mode) }}: {{ number_format((float) $payment->amount, 2) }}</p>
        @endforeach
        <p>Paid: {{ number_format((float) $sale->paid, 2) }} &nbsp; Balance Due: {{ number_format((float) $sale->due, 2) }}</p>
    </section>

    <footer class="footer">
        <p>Goods once sold are not returnable except as per policy.</p>
        <p class="meta-small">Generated by {{ $shopName }} — {{ now()->timezone(config('app.timezone', 'Asia/Kolkata'))->format('d/m/Y H:i') }}</p>
    </footer>
</div>
