<?php

declare(strict_types=1);

use App\Enums\BatchStatus;
use App\Models\Medicine;
use App\Models\MedicineBatch;
use App\Services\InventoryService;
use Illuminate\Foundation\Testing\RefreshDatabase;

/**
 * DR-FEFO-01 .. DR-FEFO-08 — First-Expiry-First-Out.
 *
 * Cave law: FEFO with a row lock. Allocation orders by expiry_date ASC
 * inside a transaction using SELECT … FOR UPDATE (brain/03-domain-rules.md
 * §2, InventoryService::allocateFefo()). These tests assert the outcome
 * (which batches were consumed, in what order and split) — the locking
 * mechanics themselves are exercised by StockLedgerConcurrencyTest.
 */
uses(RefreshDatabase::class);

it('picks the nearest-expiry batch first', function () {
    $medicine = Medicine::factory()->create();

    $far = MedicineBatch::factory()->create([
        'medicine_id' => $medicine->id,
        'expiry_date' => now()->addYear(),
        'quantity_available' => 10,
        'status' => BatchStatus::Available,
    ]);
    $near = MedicineBatch::factory()->create([
        'medicine_id' => $medicine->id,
        'expiry_date' => now()->addMonth(),
        'quantity_available' => 10,
        'status' => BatchStatus::Available,
    ]);

    $allocations = app(InventoryService::class)->allocateFefo($medicine, 1);

    expect($allocations)->toHaveCount(1)
        ->and($allocations[0]->medicine_batch_id)->toBe($near->id);

    expect($far->fresh()->quantity_available)->toBe(10);
});

it('splits across multiple batches when the nearest one is insufficient', function () {
    $medicine = Medicine::factory()->create();

    $nearest = MedicineBatch::factory()->create([
        'medicine_id' => $medicine->id,
        'expiry_date' => now()->addMonths(3),
        'quantity_available' => 4,
        'status' => BatchStatus::Available,
    ]);
    $next = MedicineBatch::factory()->create([
        'medicine_id' => $medicine->id,
        'expiry_date' => now()->addMonths(8),
        'quantity_available' => 12,
        'status' => BatchStatus::Available,
    ]);

    $allocations = app(InventoryService::class)->allocateFefo($medicine, 10);

    // DR-FEFO-05: one slice per batch touched, quantities summing exactly
    // to the requested total.
    expect($allocations)->toHaveCount(2);

    $byBatch = collect($allocations)->keyBy('medicine_batch_id');
    expect($byBatch[$nearest->id]->quantity)->toBe(4)
        ->and($byBatch[$next->id]->quantity)->toBe(6)
        ->and(collect($allocations)->sum('quantity'))->toBe(10);
});

it('never allocates an expired batch, even when it is the only stock', function () {
    $medicine = Medicine::factory()->create();

    MedicineBatch::factory()->create([
        'medicine_id' => $medicine->id,
        'expiry_date' => now()->subDay(),
        'quantity_available' => 50,
        'status' => BatchStatus::Expired,
    ]);

    // DR-EXP-02: selling expired stock is blocked hard — no override path.
    expect(fn () => app(InventoryService::class)->allocateFefo($medicine, 1))
        ->toThrow(\App\Exceptions\Domain\InsufficientStockException::class);
});

it('skips a quarantined batch even when it is nearest expiry', function () {
    $medicine = Medicine::factory()->create();

    MedicineBatch::factory()->create([
        'medicine_id' => $medicine->id,
        'expiry_date' => now()->addWeek(),
        'quantity_available' => 5,
        'status' => BatchStatus::Quarantined,
    ]);
    $sellable = MedicineBatch::factory()->create([
        'medicine_id' => $medicine->id,
        'expiry_date' => now()->addMonths(6),
        'quantity_available' => 5,
        'status' => BatchStatus::Available,
    ]);

    $allocations = app(InventoryService::class)->allocateFefo($medicine, 1);

    expect($allocations[0]->medicine_batch_id)->toBe($sellable->id);
});
