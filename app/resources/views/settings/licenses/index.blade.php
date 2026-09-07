<x-app-layout>
    <x-page-header :title="'Drug Licenses'" :breadcrumbs="[['label' => 'Drug Licenses']]">
        <x-slot name="action">
            @can('license.manage')
                <a href="{{ route('settings.licenses.create') }}"
                   class="inline-flex items-center rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">
                    New License
                </a>
            @endcan
        </x-slot>
    </x-page-header>

    <div class="mx-auto max-w-7xl px-4 py-6">
        <x-data-table :rows="$licenses" :columns="['Type', 'License Number', 'Issued On', 'Expires On', 'Issuing Authority', 'Active', 'Actions']" empty="No drug licenses found.">
            @foreach ($licenses as $license)
                @php
                    $isExpired = $license->expires_on?->isPast() ?? false;
                    $isExpiringSoon = ! $isExpired && $license->expires_on && now()->diffInDays($license->expires_on, false) <= 60;
                @endphp
                <tr class="{{ $isExpired ? 'bg-red-50' : ($isExpiringSoon ? 'bg-amber-50' : '') }}">
                    <td class="px-4 py-2">{{ $license->license_type }}</td>
                    <td class="px-4 py-2">{{ $license->license_number }}</td>
                    <td class="px-4 py-2">{{ $license->issued_on?->format('d/m/Y') ?? '—' }}</td>
                    <td class="px-4 py-2">
                        <span class="{{ $isExpired ? 'font-semibold text-red-800' : ($isExpiringSoon ? 'font-semibold text-amber-800' : '') }}">
                            {{ $license->expires_on?->format('d/m/Y') ?? '—' }}
                        </span>
                        @if ($isExpired)
                            <span class="ml-2 inline-flex items-center rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-800">Expired</span>
                        @elseif ($isExpiringSoon)
                            <span class="ml-2 inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800">
                                Expires in {{ now()->diffInDays($license->expires_on, false) }} days
                            </span>
                        @endif
                    </td>
                    <td class="px-4 py-2">{{ $license->issuing_authority ?? '—' }}</td>
                    <td class="px-4 py-2">
                        @if ($license->is_active)
                            <span class="inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-800">Yes</span>
                        @else
                            <span class="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700">No</span>
                        @endif
                    </td>
                    <td class="px-4 py-2 whitespace-nowrap">
                        @can('license.manage')
                            <a href="{{ route('settings.licenses.edit', $license) }}" class="text-brand-700 hover:underline text-sm">Edit</a>
                            <form method="POST" action="{{ route('settings.licenses.destroy', $license) }}" class="inline"
                                  onsubmit="return confirm('{{ __('Delete this license?') }}');">
                                @csrf
                                @method('DELETE')
                                <button type="submit" class="text-red-700 hover:underline text-sm ml-2">Delete</button>
                            </form>
                        @endcan
                    </td>
                </tr>
            @endforeach
        </x-data-table>

        <div class="mt-4">{{ $licenses->links() }}</div>
    </div>
</x-app-layout>
