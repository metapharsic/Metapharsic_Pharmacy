<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Exceptions\Domain\CreditLimitExceededException;
use App\Exceptions\Domain\ExpiredBatchException;
use App\Exceptions\Domain\InsufficientStockException;
use App\Exceptions\Domain\PrescriptionRequiredException;
use App\Http\Requests\StoreSaleRequest;
use App\Models\Customer;
use App\Services\SalesService;
use Illuminate\Contracts\View\View;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Str;
use Throwable;

/**
 * POS is fully AJAX-driven (brain/06-ui-conventions.md §2, §5): the cashier never leaves
 * `/pos` mid-bill. index() renders the shell once; store() and hold()/recall() are XHR
 * endpoints hit from resources/views/pos/index.blade.php's Alpine cart, never full page
 * navigations.
 *
 * Cave law 2 (cashier never sees cost): nothing in this controller ever touches
 * purchase_price / effective_cost / cost_price_at_sale. SalesService::createSale() selects
 * through withoutCost() at the query layer, so there is no "forget to hide it in the view"
 * failure mode here.
 */
class PosController extends Controller
{
    public function index(): View
    {
        return view('pos.index');
    }

    /**
     * Persist the sale. All money/stock/tax arithmetic is authoritative here and inside
     * SalesService::createSale() only — the cart totals the browser displayed are a preview
     * (brain/06 §5, "Alpine handles interaction. It never handles the domain.") and are
     * discarded; the service recomputes from scratch against locked rows.
     *
     * Each domain exception maps to a distinct JSON error_code (brain/04-coding-standards.md
     * 422 error_code convention) so the POS can show an inline, field-targeted message
     * without a page reload and without a generic "something went wrong" toast.
     */
    public function store(StoreSaleRequest $request): JsonResponse
    {
        try {
            $sale = app(SalesService::class)->createSale(
                cartLines: $request->validated('lines', []),
                customerId: $request->validated('customer_id'),
                userId: $request->user()->id,
                payments: $request->validated('payments', []),
            );

            return response()->json([
                'sale_id' => $sale->id,
                'invoice_no' => $sale->invoice_no,
                'print_a4_url' => route('sales.print', $sale),
                'print_80mm_url' => route('sales.print-thermal', $sale),
            ], 201);
        } catch (PrescriptionRequiredException $e) {
            // DR-RX-02: Schedule H line present without a prescription record or override.
            return $this->domainError('prescription_required', $e->getMessage(), 422);
        } catch (CreditLimitExceededException $e) {
            // DR-CRED-02: outstanding + this bill's due exceeds the customer's credit_limit.
            return $this->domainError('credit_limit_exceeded', $e->getMessage(), 422);
        } catch (ExpiredBatchException $e) {
            // DR-EXP-02: hard block, never sold — should be filtered client-side too, but the
            // server is the enforcement point, not the browser (brain/03 §1 cave law).
            return $this->domainError('expired_batch', $e->getMessage(), 422);
        } catch (InsufficientStockException $e) {
            // DR-FEFO-06: demand across all sellable batches was not fully coverable.
            return $this->domainError('insufficient_stock', $e->getMessage(), 422);
        } catch (Throwable $e) {
            report($e);

            return $this->domainError('sale_failed', 'The sale could not be saved. Nothing was charged or committed.', 500);
        }
    }

    private function domainError(string $code, string $message, int $status): JsonResponse
    {
        return response()->json([
            'error_code' => $code,
            'message' => $message,
        ], $status);
    }

    /**
     * Hold / recall — Phase 4 approach.
     *
     * The schema this phase inherits has no `held_bills` table (brain/05-routes-and-modules.md
     * lists `pos.hold.store` / `pos.hold.index` / `pos.hold.destroy` as the eventual route
     * surface, but no owning table is defined for Sales in this phase's scope). Rather than add
     * a table as a side effect of a controller, T-0401d is implemented here as a session/cache
     * -backed cart snapshot, keyed per user and per hold slot:
     *
     *   key = "pos:hold:{$userId}:{$slot}"
     *
     * Stored value is exactly the posCart() shape from brain/06-ui-conventions.md §5 minus the
     * `ui` key, per that section's own note. TTL is generous (12h) so a bill held at closing is
     * still there the next morning; it is NOT a durable business record — holding a bill is
     * explicitly "not a sale until it is committed" (brain/06 §3, held-bill colour semantics).
     *
     * This is single-terminal/single-user only: a bill held on one cashier login cannot be
     * recalled from a different terminal or a different logged-in user. If cross-terminal
     * recall is ever required, replace this with a real `held_bills` table (sale-shaped,
     * owned by the Sales module per brain/05 §4) and swap these two methods to read/write it
     * instead of Cache — the Alpine cart contract does not change either way.
     */
    public function hold(Request $request): JsonResponse
    {
        $request->validate([
            'slot' => ['required', 'integer', 'min:1', 'max:9'],
            'cart' => ['required', 'array'],
        ]);

        $userId = $request->user()->id;
        $slot = (int) $request->input('slot');
        $key = "pos:hold:{$userId}:{$slot}";

        if (Cache::has($key)) {
            return response()->json([
                'error_code' => 'slot_occupied',
                'message' => "Hold slot {$slot} already has a bill. Recall or clear it first.",
            ], 422);
        }

        Cache::put($key, [
            'id' => (string) Str::uuid(),
            'held_at' => now()->toIso8601String(),
            'cart' => $request->input('cart'),
        ], now()->addHours(12));

        return response()->json(['status' => 'held', 'slot' => $slot]);
    }

    public function recall(Request $request, string $slot): JsonResponse
    {
        // {slot} is a route parameter (routes/api.php), not a request field — reading it via
        // $request->input('slot') on a GET with no query string would always be null, which
        // is the bug this fixes. Validated by hand since a route param isn't Request::validate()-able.
        if (! ctype_digit($slot) || (int) $slot < 1 || (int) $slot > 9) {
            return response()->json([
                'error_code' => 'invalid_slot',
                'message' => 'Slot must be an integer 1-9.',
            ], 422);
        }

        $userId = $request->user()->id;
        $slot = (int) $slot;
        $key = "pos:hold:{$userId}:{$slot}";

        $held = Cache::get($key);

        if ($held === null) {
            return response()->json([
                'error_code' => 'not_found',
                'message' => "No held bill in slot {$slot}.",
            ], 404);
        }

        // A recalled bill cannot be recalled twice: pull it (Cache::pull removes on read).
        Cache::forget($key);

        return response()->json([
            'status' => 'recalled',
            'slot' => $slot,
            'cart' => $held['cart'],
            // Client must immediately re-POST to /api/pos/quote before allowing Save —
            // prices/stock may have moved while the bill waited (brain/06 §5 note).
            'requires_requote' => true,
        ]);
    }

    /**
     * List currently held slots for the top-strip badge (brain/06 §3 "Held bill" colour rule).
     */
    public function heldSlots(Request $request): JsonResponse
    {
        $userId = $request->user()->id;
        $slots = [];

        for ($slot = 1; $slot <= 9; $slot++) {
            if (Cache::has("pos:hold:{$userId}:{$slot}")) {
                $slots[] = $slot;
            }
        }

        return response()->json(['held_slots' => $slots]);
    }

    /**
     * F2 customer modal — phone-search lookup.
     *
     * Replaces the old dead-stub F2 modal (pos/index.blade.php previously had no markup and
     * openCustomerModal() did nothing). This is a lightweight AJAX sibling of
     * CustomersController's full-page CRUD — it exists so the cashier never leaves /pos to
     * find or add a customer mid-bill. Does NOT touch CustomersController or its routes.
     *
     * Only the fields the modal actually renders are selected — no full customer row over
     * the wire. `blocked` is derived here (outstanding_balance >= credit_limit) since it is
     * not a stored column.
     */
    public function customerSearch(Request $request): JsonResponse
    {
        $request->validate([
            'phone' => ['required', 'string'],
        ]);

        $phone = $request->input('phone');

        $customers = Customer::query()
            ->select(['id', 'name', 'phone', 'credit_limit', 'outstanding_balance'])
            ->where('phone', 'like', "%{$phone}%")
            ->limit(10)
            ->get()
            ->map(fn (Customer $customer) => $this->customerJson($customer));

        return response()->json(['customers' => $customers]);
    }

    /**
     * F2 customer modal — quick-create.
     *
     * Deliberately narrower than CustomersController::store(): a cashier mid-bill needs
     * name + phone, not the full doctor/GSTIN/address form. Reuses the same name/phone
     * validation shape as CustomersController::store() (max:150 / max:20 + unique:customers,phone)
     * so a customer created here is never invalid by the full CRUD screen's rules. Returns
     * JSON (not a redirect) — the browser never navigates away from /pos.
     */
    public function customerQuickCreate(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:150'],
            'phone' => ['nullable', 'string', 'max:20', 'unique:customers,phone'],
            'email' => ['nullable', 'email', 'max:160'],
        ]);

        $customer = Customer::create($validated);

        return response()->json($this->customerJson($customer), 201);
    }

    /**
     * Shared {id, name, phone, outstanding, credit_limit, blocked} shape read by the Alpine
     * `customer` object throughout pos/index.blade.php (customer.name, customer.blocked, …).
     */
    private function customerJson(Customer $customer): array
    {
        $creditLimit = (float) $customer->credit_limit;
        $outstanding = (float) $customer->outstanding_balance;

        return [
            'id' => $customer->id,
            'name' => $customer->name,
            'phone' => $customer->phone,
            'outstanding' => $outstanding,
            'credit_limit' => $creditLimit,
            'blocked' => $outstanding >= $creditLimit,
        ];
    }
}
