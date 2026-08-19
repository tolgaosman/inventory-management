<?php
use App\Models\User;
use Illuminate\Support\Facades\Hash;

$user = User::where('email', 'tolgaosman@sirket.com')->first();
if ($user) {
    $user->password = Hash::make('1234567');
    $user->save();
    echo "User password updated.\n";
} else {
    echo "User not found.\n";
}
