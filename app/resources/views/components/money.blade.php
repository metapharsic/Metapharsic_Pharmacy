@props(['value' => 0, 'currency' => '₹'])

@php
    $formatted = number_format((float) ($value ?? 0), 2);
@endphp

<span>{{ $currency }}{{ $formatted }}</span>
