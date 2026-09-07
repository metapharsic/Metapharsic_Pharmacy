<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class StorageZone extends Model
{
    use HasFactory;

    protected $fillable = [
        'name',
        'code',
        'temperature_type',
        'humidity_controlled',
        'description',
        'is_active',
    ];

    protected $casts = [
        'humidity_controlled' => 'boolean',
        'is_active' => 'boolean',
    ];

    public function racks(): HasMany
    {
        return $this->hasMany(Rack::class);
    }

    public function medicines(): HasMany
    {
        return $this->hasMany(Medicine::class);
    }
}
