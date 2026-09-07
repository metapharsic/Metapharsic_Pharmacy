<!-- Admin shell — brain/06-ui-conventions.md §1.
     Fixed left sidebar (240px), topbar with shop name, current user, and date.
     Nav items the current user lacks permission for are not rendered — a disabled
     menu item that errors on click is worse than an absent one. -->
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>{{ config('app.name', 'Metapharsic Pharmacy') }} @hasSection('title') — @yield('title') @endif</title>

    @vite(['resources/css/app.css', 'resources/js/app.js'])
</head>
<body class="bg-slate-100 text-slate-900 antialiased">
    <div class="min-h-screen p-3 sm:p-6">
        {{-- Floating "app window" card --}}
        <div class="mx-auto flex h-[calc(100vh-1.5rem)] max-w-[1600px] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-md sm:h-[calc(100vh-3rem)]">

            {{-- Sidebar --}}
            <aside class="hidden w-64 shrink-0 flex-col border-r border-slate-200 bg-white sm:flex">
                <div class="flex h-14 items-center border-b border-slate-200 px-5">
                    <span class="text-lg font-semibold text-brand-600">Metapharsic</span>
                </div>

                <nav class="flex-1 space-y-6 overflow-y-auto px-3 py-5 text-sm">
                    {{-- Sidebar order mirrors the workday per brain/06-ui-conventions.md §1.
                         Only Phase 1 routes are wired; the rest are placeholders for
                         Phase 2+ and are intentionally not linked yet.

                         NOTE: these links are plain <a> tags (not the shared
                         x-nav-link component) so the new pink active-state /
                         left-accent-bar / icon styling below is fully self
                         contained here — the x-nav-link component source
                         wasn't part of this restyle's file set. Every @can
                         gate from the original markup is preserved as-is. --}}

                    @php
                        $navBase = 'group flex items-center gap-3 rounded-lg px-3 py-2 font-medium transition';
                        $navActive = 'bg-rose-50 text-rose-700 border-l-4 border-rose-500 -ml-1 pl-2';
                        $navInactive = 'text-slate-600 border-l-4 border-transparent hover:bg-slate-50 hover:text-slate-900';
                    @endphp

                    <div class="space-y-1">
                        <a href="{{ route('dashboard') }}"
                           class="{{ $navBase }} {{ request()->routeIs('dashboard') ? $navActive : $navInactive }}">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="h-4 w-4 shrink-0"><path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h3a1 1 0 001-1v-3h2v3a1 1 0 001 1h3a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z"/></svg>
                            Dashboard
                        </a>
                    </div>

                    @can('pos.access')
                        <div class="space-y-1">
                            <div class="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Sales</div>
                            <a href="{{ route('pos.index') }}"
                               class="{{ $navBase }} {{ request()->routeIs('pos.*') ? $navActive : $navInactive }}">
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="h-4 w-4 shrink-0"><path d="M2.5 3a.5.5 0 000 1h.71l1.6 8.02A2 2 0 006.76 13.6h6.98a2 2 0 001.95-1.58L17 5H4.35l-.2-1H2.5zM6 16.5a1 1 0 100 2 1 1 0 000-2zm8 0a1 1 0 100 2 1 1 0 000-2z"/></svg>
                                POS / Sales
                            </a>
                        </div>
                    @endcan

                    @canany(['medicine.view', 'purchase.view', 'inventory.view', 'scheme.manage', 'rack.manage'])
                        <div class="space-y-1">
                            <div class="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Inventory</div>
                            @can('medicine.view')
                                <a href="{{ route('medicines.index') }}"
                                   class="{{ $navBase }} {{ request()->routeIs('medicines.*') ? $navActive : $navInactive }}">
                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="h-4 w-4 shrink-0"><path fill-rule="evenodd" d="M10 2a4 4 0 00-4 4v1H5a1 1 0 00-1 .93l-.6 9A1 1 0 004.4 18h11.2a1 1 0 001-1.07l-.6-9A1 1 0 0015 6h-1V6a4 4 0 00-4-4zm2 5V6a2 2 0 10-4 0v1h4zm-4 2a2 2 0 104 0 1 1 0 112 0 4 4 0 11-8 0 1 1 0 112 0z" clip-rule="evenodd"/></svg>
                                    Medicines
                                </a>
                            @endcan

                            @can('purchase.view')
                                <a href="{{ route('purchases.index') }}"
                                   class="{{ $navBase }} {{ request()->routeIs('purchases.*') ? $navActive : $navInactive }}">
                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="h-4 w-4 shrink-0"><path d="M3 3a1 1 0 000 2v9a2 2 0 002 2h2.5a.5.5 0 000-1H5a1 1 0 01-1-1V5h12v3.5a.5.5 0 001 0V5a1 1 0 100-2H3z"/><path d="M13.5 10a3.5 3.5 0 100 7 3.5 3.5 0 000-7zM6 6h8v1H6V6zm0 3h8v1H6V9z"/></svg>
                                    Purchases
                                </a>
                            @endcan

                            @can('inventory.view')
                                <a href="{{ route('inventory.index') }}"
                                   class="{{ $navBase }} {{ request()->routeIs('inventory.*') ? $navActive : $navInactive }}">
                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="h-4 w-4 shrink-0"><path d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zM3 10a1 1 0 011-1h5a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1v-6zM12 10a1 1 0 011-1h3a1 1 0 011 1v6a1 1 0 01-1 1h-3a1 1 0 01-1-1v-6z"/></svg>
                                    Inventory
                                </a>
                            @endcan

                            {{-- Phase 8f: rack master + capacity/occupancy management --}}
                            @can('rack.manage')
                                <a href="{{ route('racks.index') }}"
                                   class="{{ $navBase }} {{ request()->routeIs('racks.*') ? $navActive : $navInactive }}">
                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="h-4 w-4 shrink-0"><path d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zM3 9a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V9zM3 14a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1v-2z"/></svg>
                                    Racks
                                </a>
                            @endcan

                            {{-- Phase 8a: discount schemes ("buy 2 get 1 free" etc) --}}
                            @can('scheme.manage')
                                <a href="{{ route('discount-schemes.index') }}"
                                   class="{{ $navBase }} {{ request()->routeIs('discount-schemes.*') ? $navActive : $navInactive }}">
                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="h-4 w-4 shrink-0"><path fill-rule="evenodd" d="M5.5 3A2.5 2.5 0 003 5.5v2.879a2.5 2.5 0 00.732 1.767l6.5 6.5a2.5 2.5 0 003.536 0l2.878-2.878a2.5 2.5 0 000-3.536l-6.5-6.5A2.5 2.5 0 008.38 3H5.5zM6 7a1 1 0 100-2 1 1 0 000 2z" clip-rule="evenodd"/></svg>
                                    Discount Schemes
                                </a>
                            @endcan
                        </div>
                    @endcanany

                    @canany(['supplier.view', 'customer.view', 'user.manage', 'license.manage'])
                        <div class="space-y-1">
                            <div class="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">People</div>

                            {{-- Phase 8e: drug license number + renewal reminder --}}
                            @can('license.manage')
                                <a href="{{ route('settings.licenses.index') }}"
                                   class="{{ $navBase }} {{ request()->routeIs('settings.licenses.*') ? $navActive : $navInactive }}">
                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="h-4 w-4 shrink-0"><path fill-rule="evenodd" d="M6 3a1 1 0 00-1 1v1H4a2 2 0 00-2 2v8a2 2 0 002 2h12a2 2 0 002-2V7a2 2 0 00-2-2h-1V4a1 1 0 10-2 0v1H7V4a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clip-rule="evenodd"/></svg>
                                    Drug Licenses
                                </a>
                            @endcan
                            @can('supplier.view')
                                <a href="{{ route('suppliers.index') }}"
                                   class="{{ $navBase }} {{ request()->routeIs('suppliers.*') ? $navActive : $navInactive }}">
                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="h-4 w-4 shrink-0"><path d="M13 7a3 3 0 11-6 0 3 3 0 016 0zM10 12a6 6 0 00-6 6h12a6 6 0 00-6-6z"/></svg>
                                    Suppliers
                                </a>
                            @endcan

                            @can('customer.view')
                                <a href="{{ route('customers.index') }}"
                                   class="{{ $navBase }} {{ request()->routeIs('customers.*') ? $navActive : $navInactive }}">
                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="h-4 w-4 shrink-0"><path d="M7 8a3 3 0 100-6 3 3 0 000 6zM14.5 9a2.5 2.5 0 100-5 2.5 2.5 0 000 5zM1.615 16.428a1.224 1.224 0 01-.569-1.175 6.002 6.002 0 0111.908 0c.058.467-.172.92-.57 1.174A9.953 9.953 0 017 18a9.953 9.953 0 01-5.385-1.572zM14.5 16h-.106c.07-.297.088-.611.048-.933a7.47 7.47 0 00-1.588-3.755 4.502 4.502 0 015.874 2.636.818.818 0 01-.36.98A7.465 7.465 0 0114.5 16z"/></svg>
                                    Customers
                                </a>
                            @endcan

                            {{-- Phase 8c: doctor directory used for prescriber lookups; reuses the
                                 customer.* permission set since DoctorController authorizes against it. --}}
                            @can('customer.view')
                                <a href="{{ route('doctors.index') }}"
                                   class="{{ $navBase }} {{ request()->routeIs('doctors.*') ? $navActive : $navInactive }}">
                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="h-4 w-4 shrink-0"><path fill-rule="evenodd" d="M10 2a1 1 0 011 1v1.062a5.5 5.5 0 014.438 4.438H16.5a1 1 0 110 2h-1.062a5.5 5.5 0 01-4.438 4.438V16a1 1 0 11-2 0v-1.062a5.5 5.5 0 01-4.438-4.438H3.5a1 1 0 110-2h1.062A5.5 5.5 0 019 4.062V3a1 1 0 011-1zm0 4.5a3.5 3.5 0 100 7 3.5 3.5 0 000-7z" clip-rule="evenodd"/></svg>
                                    Doctors
                                </a>
                            @endcan

                            @can('user.manage')
                                <a href="{{ route('users.index') }}"
                                   class="{{ $navBase }} {{ request()->routeIs('users.*') ? $navActive : $navInactive }}">
                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="h-4 w-4 shrink-0"><path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-5a3 3 0 100 6 3 3 0 000-6zm-7 9a7 7 0 1114 0H3z" clip-rule="evenodd"/></svg>
                                    Users
                                </a>
                            @endcan
                        </div>
                    @endcanany

                    @canany(['report.view', 'audit.view'])
                        <div class="space-y-1">
                            <div class="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Reports</div>
                            @can('report.view')
                                <a href="{{ route('reports.sales') }}"
                                   class="{{ $navBase }} {{ request()->routeIs('reports.*') ? $navActive : $navInactive }}">
                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="h-4 w-4 shrink-0"><path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1H3a1 1 0 01-1-1v-6zM8 7a1 1 0 011-1h2a1 1 0 011 1v10a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v13a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z"/></svg>
                                    Reports
                                </a>
                            @endcan

                            @can('audit.view')
                                <a href="{{ route('audit-logs.index') }}"
                                   class="{{ $navBase }} {{ request()->routeIs('audit-logs.*') ? $navActive : $navInactive }}">
                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="h-4 w-4 shrink-0"><path fill-rule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm7 1V4l3 3h-2a1 1 0 01-1-1zM6 10a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clip-rule="evenodd"/></svg>
                                    Audit Logs
                                </a>
                            @endcan
                        </div>
                    @endcanany
                </nav>
            </aside>

            <div class="flex flex-1 flex-col overflow-hidden">
                {{-- macOS-style title bar strip (decorative only) --}}
                <div class="flex h-9 shrink-0 items-center gap-2 border-b border-slate-200 bg-slate-50 px-4">
                    <span class="h-2.5 w-2.5 rounded-full bg-red-400"></span>
                    <span class="h-2.5 w-2.5 rounded-full bg-amber-400"></span>
                    <span class="h-2.5 w-2.5 rounded-full bg-emerald-400"></span>
                    <span class="ml-3 text-xs font-medium text-slate-400">
                        {{ config('app.name', 'Metapharsic Pharmacy') }} @hasSection('title') — @yield('title') @endif
                    </span>
                </div>

                {{-- Topbar --}}
                <header class="flex h-14 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-6">
                    <div class="text-sm text-slate-500">
                        {{ now()->timezone(config('app.timezone'))->translatedFormat('l, d M Y') }}
                    </div>

                    <div class="flex items-center gap-4">
                        <div class="text-right">
                            <div class="text-sm font-medium text-slate-900">{{ auth()->user()->name }}</div>
                            <div class="text-xs text-slate-500">{{ auth()->user()->role?->label() ?? auth()->user()->role?->name }}</div>
                        </div>

                        <form method="POST" action="{{ route('logout') }}">
                            @csrf
                            <button type="submit" class="rounded-full border border-slate-200 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50">
                                Log out
                            </button>
                        </form>
                    </div>
                </header>

                <main class="flex-1 overflow-y-auto p-6">
                    @if (session('status'))
                        <div class="mb-4 rounded-full border border-ok-300 bg-ok-100 px-4 py-2 text-sm text-ok-800" role="status" aria-live="polite">
                            {{ session('status') }}
                        </div>
                    @endif

                    @isset($header)
                        <div class="mb-6">
                            {{ $header }}
                        </div>
                    @endisset

                    {{ $slot ?? '' }}
                    @yield('content')
                </main>
            </div>
        </div>
    </div>
</body>
</html>
