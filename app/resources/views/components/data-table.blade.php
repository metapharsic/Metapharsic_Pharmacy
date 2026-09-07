@props([
    'columns' => [],        // e.g. ['Name', 'Generic', 'Category', ...]
    'sort' => null,         // current sort key, for header state (optional)
    'searchable' => false,  // show the built-in filter bar slot
    'rows' => null,
])

<div {{ $attributes->class('bg-white border border-slate-200 rounded-lg overflow-hidden') }}>
    @if ($searchable || isset($filters))
        <div class="p-4 border-b border-slate-200 flex items-center gap-3">
            {{ $filters ?? '' }}
        </div>
    @endif

    <div class="overflow-x-auto">
        <table class="min-w-full divide-y divide-slate-200 text-sm">
            <thead class="bg-slate-50">
                <tr>
                    @foreach ($columns as $column)
                        <th scope="col" class="px-4 py-2 text-left font-medium text-slate-600 whitespace-nowrap">
                            {{ $column }}
                        </th>
                    @endforeach
                </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
                @if (isset($rows) && $rows instanceof \Illuminate\Support\HtmlString)
                    {{ $rows }}
                @else
                    {{ $slot }}
                @endif
            </tbody>
        </table>
    </div>

    @isset($empty)
        <div class="p-8 text-center text-slate-400" x-show="false" x-cloak>
            {{-- Caller toggles visibility server-side --}}
        </div>
    @endisset

    @isset($pagination)
        <div class="p-4 border-t border-slate-200">
            {{ $pagination }}
        </div>
    @endisset
</div>
