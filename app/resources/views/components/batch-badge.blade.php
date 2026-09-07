@props(['batch' => null, 'status' => null])

@php
    $statusValue = $status ?? (is_object($batch) && isset($batch->status) ? ($batch->status->value ?? $batch->status) : 'active');
@endphp

@if ($statusValue === 'active')
    <span class="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">Active</span>
@elseif ($statusValue === 'quarantined')
    <span class="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">Quarantined</span>
@elseif ($statusValue === 'expired')
    <span class="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800">Expired</span>
@else
    <span class="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">{{ ucfirst($statusValue) }}</span>
@endif
