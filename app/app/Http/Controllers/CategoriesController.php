<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Models\Category;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\View\View;

class CategoriesController extends Controller
{
    public function index(): View
    {
        Gate::authorize('category.view');

        $categories = Category::query()->orderBy('name')->paginate(25);

        return view('categories.index', ['categories' => $categories]);
    }

    public function create(): View
    {
        Gate::authorize('category.create');

        return view('categories.create');
    }

    public function store(Request $request): RedirectResponse
    {
        Gate::authorize('category.create');

        $data = $request->validate([
            'name' => ['required', 'string', 'max:100', 'unique:categories,name'],
            'parent_id' => ['nullable', 'integer', 'exists:categories,id'],
            'description' => ['nullable', 'string'],
            'is_active' => ['sometimes', 'boolean'],
        ]);

        $category = Category::query()->create($data);

        return to_route('categories.edit', $category)->with('status', __('Category created.'));
    }

    public function edit(Category $category): View
    {
        Gate::authorize('category.update');

        return view('categories.edit', ['category' => $category]);
    }

    public function update(Request $request, Category $category): RedirectResponse
    {
        Gate::authorize('category.update');

        $data = $request->validate([
            'name' => ['required', 'string', 'max:100', 'unique:categories,name,'.$category->id],
            'parent_id' => ['nullable', 'integer', 'exists:categories,id'],
            'description' => ['nullable', 'string'],
            'is_active' => ['sometimes', 'boolean'],
        ]);

        $category->update($data);

        return to_route('categories.edit', $category)->with('status', __('Category updated.'));
    }

    public function destroy(Category $category): RedirectResponse
    {
        Gate::authorize('category.delete');

        // Master data is deactivated first; deletion is a soft delete only, never hard.
        $category->delete();

        return to_route('categories.index')->with('status', __('Category deleted.'));
    }
}
