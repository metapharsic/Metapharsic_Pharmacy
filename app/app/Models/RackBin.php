<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class RackBin extends Model
{
    use HasFactory;

    protected $fillable = [
        'rack_shelf_id',
        'bin_code',
        'name',
    ];

    public function shelf(): BelongsTo
    {
        return $this->belongsTo(RackShelf::class, 'rack_shelf_id');
    }
}
