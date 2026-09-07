{{-- Admin-only per the `can:user.manage` route gate in routes/web.php. Follows the
     same @extends('layouts.app') + x-page-header convention as users/index.blade.php.
     Password reset and activation toggle are deliberately absent here: they go
     through the dedicated users.password / users.status routes (not yet wired),
     per UpdateUserRequest's doc block — this form only ever edits name, email, role. --}}
@extends('layouts.app')

@section('title', 'Edit user')

@section('content')
    <x-page-header :title="'Edit user: '.$user->name" />

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

    <form method="POST" action="{{ route('users.update', $user) }}"
          class="mt-6 max-w-xl bg-white border border-slate-200 rounded-lg p-6 space-y-4">
        @csrf
        @method('PUT')

        <div>
            <label for="name" class="block text-sm font-medium text-slate-700">Name</label>
            <input type="text" id="name" name="name" autofocus value="{{ old('name', $user->name) }}"
                   class="mt-1 block w-full rounded-md border-slate-300 focus:border-brand-500 focus:ring-brand-500 @error('name') border-red-400 ring-1 ring-red-400 @enderror">
            @error('name')<p class="mt-1 text-sm text-red-600">{{ $message }}</p>@enderror
        </div>

        <div>
            <label for="email" class="block text-sm font-medium text-slate-700">Email</label>
            <input type="email" id="email" name="email" value="{{ old('email', $user->email) }}"
                   class="mt-1 block w-full rounded-md border-slate-300 focus:border-brand-500 focus:ring-brand-500 @error('email') border-red-400 ring-1 ring-red-400 @enderror">
            @error('email')<p class="mt-1 text-sm text-red-600">{{ $message }}</p>@enderror
        </div>

        <div>
            <label for="role_id" class="block text-sm font-medium text-slate-700">Role</label>
            <select id="role_id" name="role_id"
                    class="mt-1 block w-full rounded-md border-slate-300 focus:border-brand-500 focus:ring-brand-500 @error('role_id') border-red-400 ring-1 ring-red-400 @enderror">
                <option value="">— Select a role —</option>
                @foreach ($roles as $role)
                    <option value="{{ $role->id }}" @selected((string) old('role_id', $user->role_id) === (string) $role->id)>{{ $role->label() }}</option>
                @endforeach
            </select>
            @error('role_id')<p class="mt-1 text-sm text-red-600">{{ $message }}</p>@enderror
        </div>

        <div>
            <span class="block text-sm font-medium text-slate-700">Status</span>
            <p class="mt-1 text-sm text-slate-500">
                @if ($user->is_active)
                    <span class="rounded bg-ok-100 px-2 py-0.5 text-xs text-ok-800">Active</span>
                @else
                    <span class="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-500">Inactive</span>
                @endif
                — not editable here; use deactivate/reactivate from the user list.
            </p>
        </div>

        <div class="flex justify-end gap-3 pt-2">
            <a href="{{ route('users.index') }}" class="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900">Cancel</a>
            <button type="submit"
                    class="inline-flex items-center px-4 py-2 bg-brand-600 border border-transparent rounded-md text-sm font-medium text-white hover:bg-brand-700">
                Save changes
            </button>
        </div>
    </form>
@endsection
