<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Models\Category;
use App\Models\DiscountScheme;
use App\Models\Medicine;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Validator;
use Illuminate\View\View;

/**
 * Admin-only management of shop-defined POS discount schemes
 * (buy_x_get_y / slab). Gated by scheme.manage on every method,
 * matching the DR-ADJ-01 pattern used by StockAdjustmentController.
 */
final class DiscountSchemeController extends Controller
{
    public function index(): View
    {
        Gate::authorize('scheme.manage');

        $schemes = DiscountScheme::query()
            ->with(['medicine', 'category'])
            ->orderBy('name')
            ->paginate(25);

        return view('discount-schemes.index', ['schemes' => $schemes]);
    }

    public function create(): View
    {
        Gate::authorize('scheme.manage');

        $medicines = Medicine::query()->orderBy('name')->get();
        $categories = Category::query()->orderBy('name')->get();

        return view('discount-schemes.create', compact('medicines', 'categories'));
    }

    public function store(Request $request): RedirectResponse
    {
        Gate::authorize('scheme.manage');

        $data = $this->validated($request);

        DiscountScheme::query()->create($data + ['created_by' => auth()->id()]);

        return to_route('discount-schemes.index')->with('status', __('Discount scheme created.'));
    }

    public function edit(DiscountScheme $discountScheme): View
    {
        Gate::authorize('scheme.manage');

        $medicines = Medicine::query()->orderBy('name')->get();
        $categories = Category::query()->orderBy('name')->get();

        return view('discount-schemes.edit', [
            'scheme' => $discountScheme,
            'medicines' => $medicines,
            'categories' => $categories,
        ]);
    }

    public function update(Request $request, DiscountScheme $discountScheme): RedirectResponse
    {
        Gate::authorize('scheme.manage');

        $data = $this->validated($request);

        $discountScheme->update($data);

        return to_route('discount-schemes.index')->with('status', __('Discount scheme updated.'));
    }

    public function destroy(DiscountScheme $discountScheme): RedirectResponse
    {
        Gate::authorize('scheme.manage');

        $discountScheme->delete();

        return to_route('discount-schemes.index')->with('status', __('Discount scheme deleted.'));
    }

    /**
     * Shared validation for store()/update(). Enforces exactly one of
     * medicine_id / category_id (never both, never neither), and the
     * type-conditional required_if rules for buy_x_get_y vs slab.
     */
    private function validated(Request $request): array
    {
        $validator = Validator::make($request->all(), [
            'name' => ['required', 'string', 'max:150'],
            'type' => ['required', 'string', 'in:buy_x_get_y,slab'],
            'medicine_id' => ['nullable', 'integer', 'exists:medicines,id'],
            'category_id' => ['nullable', 'integer', 'exists:categories,id'],
            'buy_qty' => ['required_if:type,buy_x_get_y', 'nullable', 'integer', 'min:1'],
            'get_qty' => ['required_if:type,buy_x_get_y', 'nullable', 'integer', 'min:1'],
            'min_qty' => ['required_if:type,slab', 'nullable', 'integer', 'min:1'],
            'slab_discount_percent' => ['required_if:type,slab', 'nullable', 'numeric', 'min:0', 'max:100'],
            'starts_on' => ['nullable', 'date'],
            'ends_on' => ['nullable', 'date', 'after_or_equal:starts_on'],
            'is_active' => ['sometimes', 'boolean'],
        ]);

        $validator->after(function ($validator) use ($request) {
            $hasMedicine = $request->filled('medicine_id');
            $hasCategory = $request->filled('category_id');

            if ($hasMedicine === $hasCategory) {
                $validator->errors()->add(
                    'medicine_id',
                    __('Select exactly one of medicine or category — not both, not neither.'),
                );
            }
        });

        $data = $validator->validate();
        $data['is_active'] = $request->boolean('is_active');

        return $data;
    }
}
