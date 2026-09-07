<x-app-layout>
    <x-page-header :title="'Doctors'" :breadcrumbs="[['label' => 'Doctors']]">
        <x-slot name="action">
            @can('customer.create')
                <a href="{{ route('doctors.create') }}"
                   class="inline-flex items-center rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">
                    New Doctor
                </a>
            @endcan
        </x-slot>
    </x-page-header>

    <div class="mx-auto max-w-7xl px-4 py-6">
        <form method="GET" action="{{ route('doctors.index') }}" class="mb-4 flex items-center gap-2">
            <label class="inline-flex items-center gap-1.5 text-sm text-slate-700">
                <input type="checkbox" name="active" value="1" onchange="this.form.submit()"
                    class="rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                    @checked(request()->boolean('active'))>
                Active only
            </label>
        </form>

        <x-data-table :rows="$doctors" :columns="['Name', 'Registration No.', 'Phone', 'Specialization', 'Active', 'Actions']" empty="No doctors found.">
            @foreach ($doctors as $doctor)
                <tr>
                    <td class="px-4 py-2">{{ $doctor->name }}</td>
                    <td class="px-4 py-2">{{ $doctor->registration_no ?? '—' }}</td>
                    <td class="px-4 py-2">{{ $doctor->phone ?? '—' }}</td>
                    <td class="px-4 py-2">{{ $doctor->specialization ?? '—' }}</td>
                    <td class="px-4 py-2">
                        @if ($doctor->is_active)
                            <span class="inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-800">Yes</span>
                        @else
                            <span class="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700">No</span>
                        @endif
                    </td>
                    <td class="px-4 py-2 whitespace-nowrap">
                        @can('customer.update')
                            <a href="{{ route('doctors.edit', $doctor) }}" class="text-brand-700 hover:underline text-sm">Edit</a>
                        @endcan
                        @can('customer.delete')
                            <form method="POST" action="{{ route('doctors.destroy', $doctor) }}" class="inline"
                                  onsubmit="return confirm('{{ __('Delete this doctor?') }}');">
                                @csrf
                                @method('DELETE')
                                <button type="submit" class="text-red-700 hover:underline text-sm ml-2">Delete</button>
                            </form>
                        @endcan
                    </td>
                </tr>
            @endforeach
        </x-data-table>

        <div class="mt-4">{{ $doctors->links() }}</div>
    </div>
</x-app-layout>
