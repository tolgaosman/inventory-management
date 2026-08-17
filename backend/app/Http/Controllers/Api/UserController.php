<?php

namespace App\Http\Controllers\Api;

use App\Exceptions\ApiException;
use App\Http\Controllers\Controller;
use App\Support\JsonStore;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;

/**
 * frontend/components/users/users-client.tsx currently manages users purely
 * in local React state (no lib/api module beyond the read-only listUsers()
 * in catalog.ts) — this gives it a real backend to move to. password_hash is
 * always stripped from responses.
 */
class UserController extends Controller
{
    public function __construct(private JsonStore $store)
    {
    }

    private function sanitize(array $user): array
    {
        unset($user['password_hash']);

        return $user;
    }

    public function index()
    {
        return response()->json(array_map($this->sanitize(...), $this->store->read('users')));
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'name' => ['required', 'string'],
            'email' => ['required', 'string'],
            'role' => ['required', 'in:depo,satinalma,yonetici'],
        ]);

        return $this->store->transaction(function () use ($data) {
            $users = $this->store->read('users');
            if (collect($users)->contains(fn ($u) => mb_strtolower($u['email']) === mb_strtolower($data['email']))) {
                throw ApiException::conflict('Bu e-posta adresi zaten kullanılıyor.');
            }

            $initials = collect(explode(' ', trim($data['name'])))
                ->filter()
                ->map(fn ($n) => mb_substr($n, 0, 1))
                ->take(2)
                ->implode('');

            $newUser = [
                'id' => (string) random_int(10000, 99999),
                'name' => trim($data['name']),
                'email' => trim($data['email']),
                'role' => $data['role'],
                'initials' => mb_strtoupper($initials),
                'password_hash' => Hash::make(config('inventory.demo_password')),
            ];
            $users[] = $newUser;
            $this->store->write('users', $users);

            return response()->json($this->sanitize($newUser), 201);
        });
    }

    public function update(Request $request, string $id)
    {
        $data = $request->validate([
            'name' => ['sometimes', 'string'],
            'email' => ['sometimes', 'string'],
            'role' => ['sometimes', 'in:depo,satinalma,yonetici'],
        ]);

        return $this->store->transaction(function () use ($data, $id) {
            $users = $this->store->read('users');
            $index = collect($users)->search(fn ($u) => $u['id'] === $id);
            if ($index === false) {
                throw ApiException::notFound('Kullanıcı bulunamadı.');
            }

            if (array_key_exists('email', $data) && collect($users)->contains(fn ($u) => $u['id'] !== $id && mb_strtolower($u['email']) === mb_strtolower($data['email']))) {
                throw ApiException::conflict('Bu e-posta adresi zaten kullanılıyor.');
            }

            foreach (['name', 'email', 'role'] as $field) {
                if (array_key_exists($field, $data)) {
                    $users[$index][$field] = is_string($data[$field]) ? trim($data[$field]) : $data[$field];
                }
            }

            $this->store->write('users', $users);

            return response()->json($this->sanitize($users[$index]));
        });
    }

    public function destroy(string $id)
    {
        return $this->store->transaction(function () use ($id) {
            $users = $this->store->read('users');
            $index = collect($users)->search(fn ($u) => $u['id'] === $id);
            if ($index === false) {
                throw ApiException::notFound('Kullanıcı bulunamadı.');
            }

            unset($users[$index]);
            $this->store->write('users', array_values($users));

            return response()->json(['deleted' => true]);
        });
    }
}
