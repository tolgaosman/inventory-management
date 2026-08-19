<?php
require __DIR__.'/vendor/autoload.php';
$app = require_once __DIR__.'/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use App\Models\User;

$user = User::where('email', 'arda.sahin@sirket.com')->first();
if ($user) {
    $user->role = 'satinalma';
    $user->save();
    echo "Fixed Arda's role to satinalma\n";
} else {
    echo "Arda not found\n";
}
