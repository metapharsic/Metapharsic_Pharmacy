<?php

declare(strict_types=1);

namespace App\Events;

use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

/**
 * Raised by `expiry:scan` when a batch crosses the 90-day or 30-day
 * expiry threshold for the first time (brain/01-architecture.md §5).
 *
 * Stub only — no listener is wired in this phase. Documented future
 * listener: `FlagBatchForReturn` (queued), which marks the batch for the
 * supplier-return worklist and records a dashboard alert row.
 */
final class BatchNearingExpiry
{
    use Dispatchable;
    use InteractsWithSockets;
    use SerializesModels;

    public function __construct(
        public readonly int $medicineBatchId,
    ) {
    }
}
