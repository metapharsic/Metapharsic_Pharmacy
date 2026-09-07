@props([
    'title' => null,
])

<div {{ $attributes->merge(['class' => 'bg-white border border-slate-200 rounded-lg p-6 shadow-sm']) }}>
    @if ($title)
        <div class="mb-4 pb-2 border-b border-slate-100 flex items-center justify-between">
            <h3 class="text-sm font-semibold text-slate-900">{{ $title }}</h3>
            @isset($action)
                <div>{{ $action }}</div>
            @endisset
        </div>
    @endif

    {{ $slot }}
</div>
