<x-app-layout>
    <x-page-header :title="'Discount Schemes'" :breadcrumbs="[['label' => 'Discount Schemes']]">
        <x-slot name="action">
            @can('scheme.manage')
                <a href="{{ route('discount-schemes.create') }}"
                   class="inline-flex items-center rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">
                    New Scheme
                </a>
            @endcan
        </x-slot>
    </x-page-header>

    <div class="mx-auto max-w-7xl px-4 py-6">
        <x-data-table :rows="$schemes" :columns="['Name', 'Type', 'Applies To', 'Terms', 'Active', 'Dates', 'Actions']" empty="No discount schemes found.">
            @foreach ($schemes as $scheme)
                <tr>
                    <td class="px-4 py-2">{{ $scheme->name }}</td>
                    <td class="px-4 py-2">
                        @if ($scheme->type === 'buy_x_get_y')
                            Buy X Get Y
                        @else
                            Slab Discount
                        @endif
                    </td>
                    <td class="px-4 py-2">
                        @if ($scheme->medicine)
                            {{ $scheme->medicine->name }}
                        @elseif ($scheme->category)
                            {{ $scheme->category->name }}
                        @else
                            &mdash;
                        @endif
                    </td>
                    <td class="px-4 py-2">
                        @if ($scheme->type === 'buy_x_get_y')
                            Buy {{ $scheme->buy_qty }} Get {{ $scheme->get_qty }} Free
                        @else
                            {{ rtrim(rtrim(number_format((float) $scheme->slab_discount_percent, 2), '0'), '.') }}% off at {{ $scheme->min_qty }}+ units
                        @endif
                    </td>
                    <td class="px-4 py-2">
                        @if ($scheme->is_active)
                            <span class="inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-800">Yes</span>
                        @else
                            <span class="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700">No</span>
                        @endif
                    </td>
                    <td class="px-4 py-2">
                        @if ($scheme->starts_on || $scheme->ends_on)
                            {{ $scheme->starts_on?->format('d/m/Y') ?? __('Any') }} &ndash; {{ $scheme->ends_on?->format('d/m/Y') ?? __('Any') }}
                        @else
                            Always
                        @endif
                    </td>
                    <td class="px-4 py-2 whitespace-nowrap">
                        @can('scheme.manage')
                            <a href="{{ route('discount-schemes.edit', $scheme) }}" class="text-brand-700 hover:underline text-sm">Edit</a>
                            <form method="POST" action="{{ route('discount-schemes.destroy', $scheme) }}" class="inline"
                                  onsubmit="return confirm('{{ __('Delete this discount scheme?') }}');">
                                @csrf
                                @method('DELETE')
                                <button type="submit" class="text-red-700 hover:underline text-sm ml-2">Delete</button>
                            </form>
                        @endcan
                    </td>
                </tr>
            @endforeach
        </x-data-table>

        <div class="mt-4">{{ $schemes->links() }}</div>
    </div>
</x-app-layout>
