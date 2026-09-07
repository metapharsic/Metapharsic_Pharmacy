{{-- Admin-only per the `can:user.manage` route gate in routes/web.php. Follows the
     same @extends('layouts.app') + x-page-header convention as users/index.blade.php. --}}
@extends('layouts.app')

@section('title', 'New user')

@section('content')
    <x-page-header title="New user" />

    @if ($errors->any())
        <div class="mt-6 max-w-xl mb-4 rounded-md bg-red-50 border border-red-300 p-4" aria-live="assertive">
            <p class="text-sm font-medium text-red-800">Please fix the following:</p>
            <ul class="mt-2 text-sm text-red-700 list-disc list-inside">
                @foreach ($errors->all() as $error)
                    <li>{{ $error }}</li>
                @endforeach
            </ul>
        </div>
    @endif

    <form method="POST" action="{{ route('users.store') }}"
          class="mt-6 max-w-xl bg-white border border-slate-200 rounded-lg p-6 space-y-4">
        @csrf

        <div>
            <label for="name" class="block text-sm font-medium text-slate-700">Name</label>
            <input type="text" id="name" name="name" autofocus value="{{ old('name') }}"
                   class="mt-1 block w-full rounded-md border-slate-300 focus:border-brand-500 focus:ring-brand-500 @error('name') border-red-400 ring-1 ring-red-400 @enderror">
            @error('name')<p class="mt-1 text-sm text-red-600">{{ $message }}</p>@enderror
        </div>

        <div>
            <label for="email" class="block text-sm font-medium text-slate-700">Email</label>
            <input type="email" id="email" name="email" value="{{ old('email') }}"
                   class="mt-1 block w-full rounded-md border-slate-300 focus:border-brand-500 focus:ring-brand-500 @error('email') border-red-400 ring-1 ring-red-400 @enderror">
            @error('email')<p class="mt-1 text-sm text-red-600">{{ $message }}</p>@enderror
        </div>

        <div>
            <label for="role_id" class="block text-sm font-medium text-slate-700">Role</label>
            <select id="role_id" name="role_id"
                    class="mt-1 block w-full rounded-md border-slate-300 focus:border-brand-500 focus:ring-brand-500 @error('role_id') border-red-400 ring-1 ring-red-400 @enderror">
                <option value="">— Select a role —</option>
                @foreach ($roles as $role)
                    <option value="{{ $role->id }}" @selected((string) old('role_id') === (string) $role->id)>{{ $role->label() }}</option>
                @endforeach
            </select>
            @error('role_id')<p class="mt-1 text-sm text-red-600">{{ $message }}</p>@enderror
        </div>

        <div>
            <label for="password" class="block text-sm font-medium text-slate-700">Password</label>
            <input type="password" id="password" name="password"
                   class="mt-1 block w-full rounded-md border-slate-300 focus:border-brand-500 focus:ring-brand-500 @error('password') border-red-400 ring-1 ring-red-400 @enderror">
            <p class="mt-1 text-xs text-slate-400">Minimum 10 characters.</p>
            @error('password')<p class="mt-1 text-sm text-red-600">{{ $message }}</p>@enderror
        </div>

        <div>
            <label for="password_confirmation" class="block text-sm font-medium text-slate-700">Confirm password</label>
            <input type="password" id="password_confirmation" name="password_confirmation"
                   class="mt-1 block w-full rounded-md border-slate-300 focus:border-brand-500 focus:ring-brand-500">
        </div>

        <div>
            <label class="inline-flex items-center gap-2 text-sm text-slate-700">
                <input type="checkbox" name="is_active" value="1" class="rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                       @checked(old('is_active', true))>
                Active
            </label>
        </div>

        <div class="flex justify-end gap-3 pt-2">
            <a href="{{ route('users.index') }}" class="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900">Cancel</a>
            <button type="submit"
                    class="inline-flex items-center px-4 py-2 bg-brand-600 border border-transparent rounded-md text-sm font-medium text-white hover:bg-brand-700">
                Save user
            </button>
        </div>
    </form>
@endsection
