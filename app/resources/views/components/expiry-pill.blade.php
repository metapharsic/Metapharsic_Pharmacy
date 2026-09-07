@props(['date'])

@php
    $carbonDate = is_string($date) ? \Carbon\Carbon::parse($date) : $date;
    $isExpired = $carbonDate?->isPast();
    $isSoon = !$isExpired && $carbonDate?->lte(now()->addDays(90));
@endphp

@if ($carbonDate)
    <span class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium {{ $isExpired ? 'bg-red-100 text-red-800' : ($isSoon ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-700') }}">
        {{ $carbonDate->format('m/Y') }}
    </span>
@else
    <span class="text-slate-400">—</span>
@endif
