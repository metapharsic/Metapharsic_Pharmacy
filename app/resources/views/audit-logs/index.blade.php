{{--
    Audit log viewer — brain/08-security-and-audit.md §3, phase-5-reports.md T-0508.
    Read-only: no create/edit/delete affordance anywhere on this page, matching
    the absence of any write route under /audit. Old/new values are rendered
    as pretty-printed JSON behind a <details> disclosure per T-0508a — a
    readable diff, not a raw jsonb dump.
--}}
<x-app-layout>
    <x-slot name="title">Audit Log</x-slot>

    <div class="space-y-4">
        <h1 class="text-xl font-semibold text-slate-900">Audit Log</h1>

        <form method="GET" action="{{ route('audit-logs.index') }}" class="flex flex-wrap items-end gap-3 rounded-lg border border-slate-200 bg-white p-4">
            <div>
                <label for="user_id" class="block text-xs font-medium text-slate-600">User</label>
                <select id="user_id" name="user_id" class="mt-1 rounded border-slate-300 text-sm">
                    <option value="">All</option>
                    @foreach (($users ?? []) as $user)
                        <option value="{{ $user->id }}" @selected(request('user_id') == $user->id)>{{ $user->name }}</option>
                    @endforeach
                </select>
            </div>
            <div>
                <label for="action" class="block text-xs font-medium text-slate-600">Action</label>
                <select id="action" name="action" class="mt-1 rounded border-slate-300 text-sm">
                    <option value="">All</option>
                    @foreach (($actions ?? []) as $actionKey)
                        <option value="{{ $actionKey }}" @selected(request('action') === $actionKey)>{{ $actionKey }}</option>
                    @endforeach
                </select>
            </div>
            <div>
                <label for="date_from" class="block text-xs font-medium text-slate-600">From</label>
                <input type="date" id="date_from" name="date_from" value="{{ request('date_from') }}" class="mt-1 rounded border-slate-300 text-sm">
            </div>
            <div>
                <label for="date_to" class="block text-xs font-medium text-slate-600">To</label>
                <input type="date" id="date_to" name="date_to" value="{{ request('date_to') }}" class="mt-1 rounded border-slate-300 text-sm">
            </div>
            <button type="submit" class="rounded bg-brand-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-brand-700">
                Filter
            </button>
        </form>

        <div class="overflow-x-auto rounded-lg border border-slate-200 bg-white">
            <table class="w-full text-sm">
                <thead class="bg-slate-50">
                    <tr class="text-left text-xs uppercase tracking-wide text-slate-500">
                        <th scope="col" class="px-4 py-2">Time</th>
                        <th scope="col" class="px-4 py-2">User</th>
                        <th scope="col" class="px-4 py-2">Action</th>
                        <th scope="col" class="px-4 py-2">Model</th>
                        <th scope="col" class="px-4 py-2">IP</th>
                        <th scope="col" class="px-4 py-2">Change</th>
                    </tr>
                </thead>
                <tbody>
                    @forelse (($logs ?? []) as $log)
                        <tr class="border-t border-slate-100 align-top">
                            <td class="px-4 py-2 whitespace-nowrap">
                                {{ optional($log->created_at)->timezone(config('app.timezone'))->format('d M Y, H:i') }}
                            </td>
                            <td class="px-4 py-2">{{ $log->user->name ?? 'System' }}</td>
                            <td class="px-4 py-2">
                                <span class="rounded bg-slate-100 px-2 py-0.5 font-mono text-xs text-slate-700">{{ $log->action }}</span>
                            </td>
                            <td class="px-4 py-2">
                                @if ($log->model_type)
                                    {{ class_basename($log->model_type) }} #{{ $log->model_id }}
                                @else
                                    —
                                @endif
                            </td>
                            <td class="px-4 py-2">{{ $log->ip_address ?? '—' }}</td>
                            <td class="px-4 py-2">
                                @if ($log->old_values || $log->new_values)
                                    <details>
                                        <summary class="cursor-pointer text-xs text-brand-700 underline">View diff</summary>
                                        <div class="mt-2 space-y-2">
                                            @if ($log->old_values)
                                                <div>
                                                    <div class="text-xs font-medium text-slate-500">Old</div>
                                                    <pre class="mt-1 max-w-xs overflow-x-auto rounded bg-slate-50 p-2 text-xs">{{ json_encode($log->old_values, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES) }}</pre>
                                                </div>
                                            @endif
                                            @if ($log->new_values)
                                                <div>
                                                    <div class="text-xs font-medium text-slate-500">New</div>
                                                    <pre class="mt-1 max-w-xs overflow-x-auto rounded bg-slate-50 p-2 text-xs">{{ json_encode($log->new_values, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES) }}</pre>
                                                </div>
                                            @endif
                                            @if ($log->context)
                                                <div>
                                                    <div class="text-xs font-medium text-slate-500">Context</div>
                                                    <pre class="mt-1 max-w-xs overflow-x-auto rounded bg-slate-50 p-2 text-xs">{{ json_encode($log->context, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES) }}</pre>
                                                </div>
                                            @endif
                                        </div>
                                    </details>
                                @else
                                    —
                                @endif
                            </td>
                        </tr>
                    @empty
                        <tr>
                            <td colspan="6" class="px-4 py-6 text-center text-slate-500">No audit events match this filter.</td>
                        </tr>
                    @endforelse
                </tbody>
            </table>
        </div>

        {{ ($logs ?? null)?->links() }}
    </div>
</x-app-layout>
