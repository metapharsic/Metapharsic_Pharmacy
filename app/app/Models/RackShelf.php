<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class RackShelf extends Model
{
    use HasFactory;

    protected $fillable = [
        'rack_id',
        'shelf_number',
        'shelf_code',
        'capacity_units',
        'notes',
    ];

    public function rack(): BelongsTo
    {
        return $this->belongsTo(Rack::class);
    }

    public function bins(): HasMany
    {
        return $this->hasMany(RackBin::class);
    }

    public function medicines(): HasMany
    {
        return $this->hasMany(Medicine::class);
    }

    public function batches(): HasMany
    {
        return $this->hasMany(MedicineBatch::class);
    }
}
