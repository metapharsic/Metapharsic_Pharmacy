<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasManyThrough;

class Rack extends Model
{
    use HasFactory;

    protected $fillable = [
        'storage_zone_id',
        'rack_code',
        'name',
        'aisle',
        'row_number',
        'column_number',
        'total_shelves',
        'max_capacity_boxes',
        'status',
    ];

    public function zone(): BelongsTo
    {
        return $this->belongsTo(StorageZone::class, 'storage_zone_id');
    }

    public function shelves(): HasMany
    {
        return $this->hasMany(RackShelf::class)->orderBy('shelf_number');
    }

    public function medicines(): HasMany
    {
        return $this->hasMany(Medicine::class);
    }
}
