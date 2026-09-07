<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * DR-RX-06: one record per sale, whether a genuine prescription capture or an authorised
 * override (`overridden_by` + `override_reason` set). DR-RX-07: never deleted; a wrong
 * entry is corrected by cancelling the sale and re-billing.
 */
class Prescription extends Model
{
    use HasFactory;

    protected $fillable = [
        'sale_id',
        'prescription_number',
        'doctor_name',
        'overridden_by',
        'override_reason',
        'image_path',
        'image_uploaded_at',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'image_uploaded_at' => 'datetime',
        ];
    }

    public function sale(): BelongsTo
    {
        return $this->belongsTo(Sale::class);
    }

    public function overriddenBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'overridden_by');
    }

    /**
     * Phase 8b: one image per prescription, immutable once set — see
     * PrescriptionImageController::store.
     */
    public function hasImage(): bool
    {
        return $this->image_path !== null;
    }
}
