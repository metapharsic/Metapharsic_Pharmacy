@props(['disabled' => false, 'name' => '', 'id' => null, 'label' => null, 'value' => null, 'rows' => 3])

<div>
    @if ($label)
        <label for="{{ $id ?? $name }}" class="block text-xs font-medium text-slate-700 mb-1">{{ $label }}</label>
    @endif
    <textarea {{ $disabled ? 'disabled' : '' }} name="{{ $name }}" id="{{ $id ?? $name }}" rows="{{ $rows }}" {!! $attributes->merge(['class' => 'rounded-md border-slate-300 shadow-sm focus:border-brand-500 focus:ring-brand-500 text-sm w-full']) !!}>{{ $value ?? old($name) }}</textarea>
</div>
