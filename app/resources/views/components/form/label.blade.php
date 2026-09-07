@props(['value' => null, 'for' => null])

<label {{ $for ? "for={$for}" : '' }} {{ $attributes->merge(['class' => 'block font-medium text-sm text-slate-700']) }}>
    {{ $value ?? $slot }}
</label>
