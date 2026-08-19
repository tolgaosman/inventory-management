<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

// Requires something calling `php artisan schedule:run` every minute (cron,
// Windows Task Scheduler, or the hosting platform's scheduler) to actually fire.
Schedule::command('backup:database')->daily();
