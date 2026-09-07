<?php

declare(strict_types=1);

namespace App\DTO;

use App\Models\MedicineBatch;
use ArrayAccess;

/**
 * @implements ArrayAccess<string, mixed>
 */
class StockAllocation implements ArrayAccess
{
    public int $medicine_batch_id;
    public int $quantity;
    public MedicineBatch $batch;
    public int $qty;

    public function __construct(MedicineBatch $batch, int $quantity)
    {
        $this->batch = $batch;
        $this->quantity = $quantity;
        $this->qty = $quantity;
        $this->medicine_batch_id = (int) $batch->id;
    }

    public function offsetExists(mixed $offset): bool
    {
        return in_array($offset, ['batch', 'qty', 'quantity', 'medicine_batch_id'], true);
    }

    public function offsetGet(mixed $offset): mixed
    {
        return match ($offset) {
            'batch' => $this->batch,
            'qty', 'quantity' => $this->quantity,
            'medicine_batch_id' => $this->medicine_batch_id,
            default => null,
        };
    }

    public function offsetSet(mixed $offset, mixed $value): void
    {
        // Immutable
    }

    public function offsetUnset(mixed $offset): void
    {
        // Immutable
    }

    public function __get(string $name): mixed
    {
        return $this->offsetGet($name);
    }
}
