@props(['disabled' => false, 'name' => '', 'id' => null, 'label' => null, 'value' => null])

<div>
    @if ($label)
        <label for="{{ $id ?? $name }}" class="block text-xs font-medium text-slate-700 mb-1">{{ $label }}</label>
    @endif
    <input type="date" {{ $disabled ? 'disabled' : '' }} name="{{ $name }}" id="{{ $id ?? $name }}" value="{{ $value ?? old($name) }}" {!! $attributes->merge(['class' => 'rounded-md border-slate-300 shadow-sm focus:border-brand-500 focus:ring-brand-500 text-sm']) !!}>
</div>
