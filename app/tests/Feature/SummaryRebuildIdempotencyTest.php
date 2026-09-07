<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Models\DailySalesSummary;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class SummaryRebuildIdempotencyTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed();
    }

    public function test_rebuild_command_runs_idempotently(): void
    {
        $today = Carbon::today()->toDateString();

        $this->artisan('summary:rebuild', ['date' => $today])
            ->assertExitCode(0);

        $rowCountAfterFirstRun = DailySalesSummary::query()->count();

        $this->artisan('summary:rebuild', ['date' => $today])
            ->assertExitCode(0);

        $rowCountAfterSecondRun = DailySalesSummary::query()->count();

        $this->assertEquals($rowCountAfterFirstRun, $rowCountAfterSecondRun);
    }
}
