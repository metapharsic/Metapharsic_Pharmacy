<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Carbon;

/**
 * A shop-level Drug License (DL) record — Phase 8e / Gap 5
 * (brain/11-gap-closure-architecture.md §6). Pure compliance master data: no
 * stock or sale interaction. A pharmacy may hold more than one license row
 * concurrently (multiple DL categories).
 */
class ShopLicense extends Model
{
    use HasFactory;

    protected $fillable = [
        'license_type',
        'license_number',
        'issued_on',
        'expires_on',
        'issuing_authority',
        'is_active',
    ];

    protected $casts = [
        'issued_on' => 'date',
        'expires_on' => 'date',
        'is_active' => 'boolean',
    ];

    public function scopeActive(Builder $query): Builder
    {
        return $query->where('is_active', true);
    }

    /**
     * Whole days from now until expires_on. Negative when already expired
     * (works for both cases — do not clamp to zero, CheckLicenseExpiry and
     * any dashboard banner rely on the sign to distinguish "expiring soon"
     * from "already expired").
     */
    public function daysUntilExpiry(): int
    {
        return (int) Carbon::now()->startOfDay()->diffInDays($this->expires_on, false);
    }
}
