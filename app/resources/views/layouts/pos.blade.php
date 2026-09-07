<!DOCTYPE html>
<html lang="en" class="h-full bg-slate-100">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="csrf-token" content="{{ csrf_token() }}">
    <title>{{ config('app.name', 'Metapharsic POS') }} — POS</title>
    @vite(['resources/css/app.css', 'resources/js/app.js'])
</head>
<body class="h-full antialiased font-sans text-slate-800">
    <div class="flex flex-col h-full">
        <header class="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-2 shrink-0">
            <div class="flex items-center gap-2.5">
                <span class="h-2.5 w-2.5 rounded-full bg-red-400"></span>
                <span class="h-2.5 w-2.5 rounded-full bg-amber-400"></span>
                <span class="h-2.5 w-2.5 rounded-full bg-emerald-400"></span>
                <a href="{{ route('dashboard') }}" class="ml-2 font-bold text-brand-600 hover:text-brand-700 flex items-center gap-1.5 text-base">
                    <span>&larr;</span> Metapharsic POS
                </a>
                <span class="rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-semibold text-brand-700">Till 1</span>
            </div>
            <div class="flex items-center gap-3 text-xs text-slate-500">
                <span>{{ auth()->user()->name }}</span>
                <span>•</span>
                <span>{{ now()->format('d M Y, h:i A') }}</span>
            </div>
        </header>
        <main class="flex-1 overflow-hidden">
            @yield('content')
        </main>
    </div>
    @stack('scripts')
</body>
</html>
