<?php

use App\Models\User;
use Illuminate\Support\Facades\Hash;

$users = [
    [
        'name' => 'Arda İbrahim Şahin',
        'email' => 'arda.sahin@sirket.com',
        'password' => '1234567',
        'role' => 'satinalma_yonetici',
        'initials' => 'AŞ'
    ],
    [
        'name' => 'Berk Fenk',
        'email' => 'berk.fenk@sirket.com',
        'password' => '1234567',
        'role' => 'satinalma',
        'initials' => 'BF'
    ],
    [
        'name' => 'Mustafa Hacı',
        'email' => 'mustafa.haci@sirket.com',
        'password' => '1234567',
        'role' => 'depo',
        'initials' => 'MH'
    ]
];

foreach ($users as $u) {
    $existing = User::where('email', $u['email'])->first();
    if (!$existing) {
        User::create([
            'id' => (string) (10000 + User::count() + random_int(1, 89000)),
            'name' => $u['name'],
            'email' => $u['email'],
            'password' => Hash::make($u['password']),
            'role' => $u['role'],
            'initials' => $u['initials']
        ]);
        echo "Created " . $u['name'] . "\n";
    } else {
        $existing->update([
            'password' => Hash::make($u['password']),
            'role' => $u['role']
        ]);
        echo "Updated " . $u['name'] . "\n";
    }
}
