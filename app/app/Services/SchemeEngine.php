<?php

declare(strict_types=1);

namespace App\Services;

use App\Models\DiscountScheme;
use App\Models\Medicine;

/**
 * Cave law 1: discount-COMPUTATION-only. This engine never writes to stock_transactions
 * and never calls InventoryService — it only tells SalesService::createSale() how much
 * extra discount to apply to a line's gross value. The quantity actually allocated and
 * deducted is decided entirely by InventoryService::allocateFefo()/deductStock(), and is
 * never changed here (a "buy 2 get 1 free" sale of 3 units still allocates and deducts 3
 * real units — this engine just makes the 3rd unit's price effectively zero via a
 * discount amount, it does not create a separate free-goods stock event).
 */
class SchemeEngine
{
    /**
     * Finds the best applicable active scheme for this medicine/quantity/gross line value
     * and returns the discount it earns, or null if no scheme applies.
     *
     * @return array{scheme_id: int, discount_amount: float}|null
     */
    public function bestSchemeFor(Medicine $medicine, int $quantity, float $grossLineValue): ?array
    {
        if ($quantity <= 0 || $grossLineValue <= 0.0) {
            return null;
        }

        $candidates = DiscountScheme::query()
            ->active()
            ->where(function ($q) use ($medicine): void {
                $q->where('medicine_id', $medicine->id)
                    ->orWhere('category_id', $medicine->category_id);
            })
            ->get();

        $best = null; // ['scheme_id' => int, 'discount_amount' => float, 'is_direct_match' => bool]

        foreach ($candidates as $scheme) {
            $discount = $this->computeDiscount($scheme, $quantity, $grossLineValue);

            if ($discount === null || $discount <= 0.0) {
                continue;
            }

            $isDirectMatch = $scheme->medicine_id === $medicine->id;

            if ($best === null) {
                $best = ['scheme_id' => (int) $scheme->id, 'discount_amount' => $discount, 'is_direct_match' => $isDirectMatch];

                continue;
            }

            // Direct medicine-level match takes priority over a category-level scheme
            // when both are applicable, even if the category scheme's raw discount is
            // larger; among schemes of the same match-priority, the larger discount wins.
            if ($isDirectMatch && ! $best['is_direct_match']) {
                $best = ['scheme_id' => (int) $scheme->id, 'discount_amount' => $discount, 'is_direct_match' => $isDirectMatch];

                continue;
            }

            if ($isDirectMatch === $best['is_direct_match'] && $discount > $best['discount_amount']) {
                $best = ['scheme_id' => (int) $scheme->id, 'discount_amount' => $discount, 'is_direct_match' => $isDirectMatch];
            }
        }

        if ($best === null) {
            return null;
        }

        return ['scheme_id' => $best['scheme_id'], 'discount_amount' => $best['discount_amount']];
    }

    private function computeDiscount(DiscountScheme $scheme, int $quantity, float $grossLineValue): ?float
    {
        return match ($scheme->type) {
            'buy_x_get_y' => $this->computeBuyXGetY($scheme, $quantity, $grossLineValue),
            'slab' => $this->computeSlab($scheme, $quantity, $grossLineValue),
            default => null,
        };
    }

    private function computeBuyXGetY(DiscountScheme $scheme, int $quantity, float $grossLineValue): ?float
    {
        $buyQty = (int) $scheme->buy_qty;
        $getQty = (int) $scheme->get_qty;

        if ($buyQty <= 0 || $getQty <= 0) {
            return null;
        }

        $freeSets = intdiv($quantity, $buyQty + $getQty);

        if ($freeSets <= 0) {
            return null;
        }

        $freeUnits = $freeSets * $getQty;
        $unitPrice = $grossLineValue / $quantity;

        return round($unitPrice * $freeUnits, 2);
    }

    private function computeSlab(DiscountScheme $scheme, int $quantity, float $grossLineValue): ?float
    {
        $minQty = (int) $scheme->min_qty;

        if ($minQty <= 0 || $quantity < $minQty) {
            return null;
        }

        $percent = (float) $scheme->slab_discount_percent;

        if ($percent <= 0.0) {
            return null;
        }

        return round($grossLineValue * $percent / 100, 2);
    }
}
