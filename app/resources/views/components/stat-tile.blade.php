{{--
    x-stat-tile — brain/06-ui-conventions.md §4.
    Dashboard big number: label, value, optional trend delta, optional
    drill-through link. Colour is decided by the caller via $trendDirection
    (up/down/flat) — this component carries no domain knowledge of what a
    good or bad trend means for a given metric.

    Props:
      label          string   required
      value          string   required — already formatted (x-money etc.) by the caller
      trend          string   optional — e.g. "+12% vs yesterday"
      trendDirection string   optional — "up" | "down" | "flat", default "flat"
      href           string   optional — wraps the tile in a link when set
--}}
@props([
    'label',
    'value',
    'trend' => null,
    'trendDirection' => 'flat',
    'href' => null,
])

@php
    $trendClass = match ($trendDirection) {
        'up' => 'text-ok-700',
        'down' => 'text-danger-700',
        default => 'text-slate-500',
    };

    $tag = $href ? 'a' : 'div';
@endphp

<{{ $tag }}
    @if ($href) href="{{ $href }}" @endif
    {{ $attributes->merge([
        'class' => 'block rounded-lg border border-slate-200 bg-white p-4 shadow-sm'
            . ($href ? ' transition hover:border-brand-300 hover:shadow' : ''),
    ]) }}
>
    <div class="text-xs font-medium uppercase tracking-wide text-slate-500">{{ $label }}</div>
    <div class="mt-1 text-2xl font-semibold tabular-nums text-slate-900">{{ $value }}</div>

    @if ($trend)
        <div class="mt-1 text-xs font-medium {{ $trendClass }}">{{ $trend }}</div>
    @endif
</{{ $tag }}>
