<?php

namespace App\Http\Controllers\Api;

use App\Exceptions\ApiException;
use App\Http\Controllers\Controller;
use App\Models\StockMovement;
use App\Models\User;
use App\Support\IdGenerator;
use App\Support\Present;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;

/**
 * frontend/components/users/users-client.tsx used to manage users purely in
 * local React state — this is the real backend it moves to. Present::user()
 * never emits the password hash.
 */
class UserController extends Controller
{
    public function index(Request $request)
    {
        $query = User::query()->when($request->query('trashed') === '1', fn($q) => $q->onlyTrashed());
        $user = auth()->user();
        
        if ($user->role === 'depo_yonetici') {
            $query->whereIn('role', ['depo', 'depo_yonetici']);
        } elseif ($user->role === 'satinalma_yonetici') {
            $query->whereIn('role', ['satinalma', 'satinalma_yonetici']);
        }

        return response()->json($query->get()->map(fn ($u) => Present::user($u))->all());
    }

    private function initialsFor(string $name): string
    {
        $initials = collect(explode(' ', trim($name)))
            ->filter()
            ->map(fn ($n) => mb_substr($n, 0, 1))
            ->take(2)
            ->implode('');

        return mb_strtoupper($initials);
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'name' => ['required', 'string'],
            'email' => ['required', 'string'],
            'role' => ['required', 'in:admin,depo_yonetici,satinalma_yonetici,depo,satinalma'],
        ]);

        $authUser = request()->user();
        // Same department scoping as update()/destroy(): a manager may only
        // create accounts for their own department, never the other side or
        // another admin/manager. Only admin can create outside that box.
        if ($authUser->role === 'depo_yonetici') {
            if (! in_array($data['role'], ['depo', 'depo_yonetici'], true)) {
                throw ApiException::forbidden('Sadece kendi departmanınızda kullanıcı oluşturabilirsiniz.');
            }
        } elseif ($authUser->role === 'satinalma_yonetici') {
            if (! in_array($data['role'], ['satinalma', 'satinalma_yonetici'], true)) {
                throw ApiException::forbidden('Sadece kendi departmanınızda kullanıcı oluşturabilirsiniz.');
            }
        } elseif ($authUser->role !== 'admin') {
            throw ApiException::forbidden('Kullanıcı oluşturma yetkiniz yok.');
        }

        $user = DB::transaction(function () use ($data) {
            $exists = User::query()->whereRaw('lower(email) = ?', [mb_strtolower(trim($data['email']))])->exists();
            if ($exists) {
                throw ApiException::conflict('Bu e-posta adresi zaten kullanılıyor.');
            }

            return User::query()->create([
                // Users have bare 5-digit ids in the seed; keep the format but
                // derive it collision-free instead of random_int().
                'id' => (string) (10000 + (int) User::query()->count() + random_int(1, 89000)),
                'name' => trim($data['name']),
                'email' => trim($data['email']),
                'role' => $data['role'],
                'initials' => $this->initialsFor($data['name']),
                'password' => config('inventory.demo_password'),
                // Admin-created accounts share a known default password —
                // force a real one to be set before anything else is usable.
                'must_change_password' => true,
            ]);
        });

        return response()->json(Present::user($user), 201);
    }

    public function update(Request $request, string $id)
    {
        $data = $request->validate([
            'name' => ['sometimes', 'string'],
            'email' => ['sometimes', 'string'],
            'role' => ['sometimes', 'in:admin,depo_yonetici,satinalma_yonetici,depo,satinalma'],
        ]);

        $user = DB::transaction(function () use ($data, $id) {
            $user = User::query()->lockForUpdate()->find($id);
            if (! $user) {
                throw ApiException::notFound('Kullanıcı bulunamadı.');
            }

            $authUser = request()->user();

            if ($authUser->role === 'depo_yonetici') {
                if (!in_array($user->role, ['depo', 'depo_yonetici'], true)) {
                    throw ApiException::forbidden('Sadece kendi departmanınızdaki kullanıcıları düzenleyebilirsiniz.');
                }
            } elseif ($authUser->role === 'satinalma_yonetici') {
                if (!in_array($user->role, ['satinalma', 'satinalma_yonetici'], true)) {
                    throw ApiException::forbidden('Sadece kendi departmanınızdaki kullanıcıları düzenleyebilirsiniz.');
                }
            } elseif ($authUser->role !== 'admin') {
                throw ApiException::forbidden('Kullanıcı düzenleme yetkiniz yok.');
            }

            if (array_key_exists('role', $data) && $data['role'] !== $user->role) {
                if ($authUser->role === 'depo_yonetici') {
                    if (!in_array($data['role'], ['depo', 'depo_yonetici'], true)) {
                        throw ApiException::forbidden('Sadece kendi departmanınızdaki rollere atama yapabilirsiniz.');
                    }
                } elseif ($authUser->role === 'satinalma_yonetici') {
                    if (!in_array($data['role'], ['satinalma', 'satinalma_yonetici'], true)) {
                        throw ApiException::forbidden('Sadece kendi departmanınızdaki rollere atama yapabilirsiniz.');
                    }
                } elseif ($authUser->role !== 'admin') {
                    throw ApiException::forbidden('Rol değiştirme yetkiniz yok.');
                }
            }

            if (array_key_exists('email', $data)) {
                $taken = User::query()
                    ->whereKeyNot($id)
                    ->whereRaw('lower(email) = ?', [mb_strtolower(trim($data['email']))])
                    ->exists();
                if ($taken) {
                    throw ApiException::conflict('Bu e-posta adresi zaten kullanılıyor.');
                }
            }

            foreach (['name', 'email', 'role'] as $field) {
                if (array_key_exists($field, $data)) {
                    $user->{$field} = trim($data[$field]);
                }
            }
            if (array_key_exists('name', $data)) {
                $user->initials = $this->initialsFor($data['name']);
            }
            $user->save();

            return $user;
        });

        return response()->json(Present::user($user));
    }

    public function destroy(Request $request, string $id)
    {
        DB::transaction(function () use ($request, $id) {
            $user = User::query()->lockForUpdate()->find($id);
            if (! $user) {
                throw ApiException::notFound('Kullanıcı bulunamadı.');
            }

            $authUser = request()->user();
            if ($authUser->role === 'depo_yonetici' && !in_array($user->role, ['depo', 'depo_yonetici'])) {
                throw ApiException::forbidden('Sadece kendi departmanınızdaki kullanıcıları silebilirsiniz.');
            }
            if ($authUser->role === 'satinalma_yonetici' && !in_array($user->role, ['satinalma', 'satinalma_yonetici'])) {
                throw ApiException::forbidden('Sadece kendi departmanınızdaki kullanıcıları silebilirsiniz.');
            }

            if ($request->user()?->getKey() === $user->getKey()) {
                throw ApiException::conflict('Kendi hesabınızı silemezsiniz.');
            }

            // Movements carry a restrict-on-delete FK to users; blocking here
            // gives a Turkish message instead of a raw constraint violation.
            $movementCount = StockMovement::query()->where('user_id', $id)->count();
            if ($movementCount > 0) {
                throw ApiException::conflict("Bu kullanıcıya ait {$movementCount} stok hareketi olduğu için silinemez.");
            }

            $user->tokens()->delete();
            $user->deleteAs($request->user()->getKey());
        });

        return response()->json(['deleted' => true]);
    }

    public function restore(string $id)
    {
        $model = \App\Models\User::withTrashed()->find($id);
        if (!$model) {
            throw \App\Exceptions\ApiException::notFound('Kayıt bulunamadı.');
        }
        $model->restoreTracked();
        return response()->json(['restored' => true]);
    }
}
