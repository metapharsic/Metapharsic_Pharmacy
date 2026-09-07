{{-- Phase 1 placeholder dashboard. Real widgets (stat tiles, alerts) land in
     Phase 5 per brain/05-routes-and-modules.md — this view only proves the shell,
     auth, and permission-filtered nav are wired end to end (gate G1.1/G1.2). --}}
@extends('layouts.app')

@section('title', 'Dashboard')

@section('content')
    <x-page-header title="Dashboard" />

    <div class="mt-6 rounded border border-slate-200 bg-white p-6">
        <p class="text-sm text-slate-500">Phase 1 — Foundation</p>

        <dl class="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
                <dt class="text-xs uppercase tracking-wide text-slate-400">Today</dt>
                <dd class="mt-1 text-base font-medium text-slate-900">
                    {{ now()->timezone(config('app.timezone'))->translatedFormat('d M Y') }}
                </dd>
            </div>

            <div>
                <dt class="text-xs uppercase tracking-wide text-slate-400">Logged in as</dt>
                <dd class="mt-1 text-base font-medium text-slate-900">{{ auth()->user()->name }}</dd>
            </div>

            <div>
                <dt class="text-xs uppercase tracking-wide text-slate-400">Role</dt>
                <dd class="mt-1 text-base font-medium text-slate-900">
                    {{ auth()->user()->role?->label() ?? auth()->user()->role?->name }}
                </dd>
            </div>
        </dl>

        <p class="mt-6 text-sm text-slate-400">
            Sales, stock, and expiry widgets are wired in Phase 5. No live data here yet.
        </p>
    </div>
@endsection
