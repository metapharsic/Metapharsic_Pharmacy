@props(['disabled' => false, 'name' => '', 'id' => null, 'label' => null, 'options' => [], 'value' => null])

<div>
    @if ($label)
        <label for="{{ $id ?? $name }}" class="block text-xs font-medium text-slate-700 mb-1">{{ $label }}</label>
    @endif
    <select {{ $disabled ? 'disabled' : '' }} name="{{ $name }}" id="{{ $id ?? $name }}" {!! $attributes->merge(['class' => 'rounded-md border-slate-300 shadow-sm focus:border-brand-500 focus:ring-brand-500 text-sm']) !!}>
        @if (!empty($options))
            @foreach ($options as $optValue => $optLabel)
                <option value="{{ $optValue }}" @selected((string) $value === (string) $optValue)>{{ $optLabel }}</option>
            @endforeach
        @endif
        {{ $slot }}
    </select>
</div>
