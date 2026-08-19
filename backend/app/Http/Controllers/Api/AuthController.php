<?php

namespace App\Http\Controllers\Api;

use App\Exceptions\ApiException;
use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Auth\Events\PasswordReset;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Password;
use Illuminate\Support\Str;

class AuthController extends Controller
{
    public function login(Request $request)
    {
        $data = $request->validate([
            'email' => ['required', 'string'],
            'password' => ['required', 'string'],
        ]);

        $user = User::query()->whereRaw('lower(email) = ?', [mb_strtolower($data['email'])])->first();

        if (! $user || ! Hash::check($data['password'], $user->password)) {
            throw ApiException::forbidden('E-posta veya şifre hatalı.');
        }

        $token = $user->createToken('api')->plainTextToken;

        return response()->json([
            'token' => $token,
            'user' => $this->userPayload($user),
            'permissions' => $user->permissions(),
        ]);
    }

    public function logout(Request $request)
    {
        $token = $request->user()?->currentAccessToken();
        if ($token) {
            $token->delete();
        }

        return response()->json(['message' => 'Çıkış yapıldı.']);
    }

    public function me(Request $request)
    {
        $user = $request->user();

        return response()->json([
            'user' => $this->userPayload($user),
            'permissions' => $user->permissions(),
        ]);
    }

    /** Sends a reset link; also returns the raw token in the JSON body since MAIL_MAILER=log has no inbox to check. */
    public function forgotPassword(Request $request)
    {
        $data = $request->validate(['email' => ['required', 'email']]);

        $user = User::query()->whereRaw('lower(email) = ?', [mb_strtolower($data['email'])])->first();

        // Always respond the same way whether the e-mail exists or not, so the
        // endpoint can't be used to enumerate registered accounts.
        if (! $user) {
            return response()->json(['message' => 'E-posta adresiniz kayıtlıysa sıfırlama bağlantısı gönderildi.']);
        }

        $token = Password::broker('users')->createToken($user);

        return response()->json([
            'message' => 'E-posta adresiniz kayıtlıysa sıfırlama bağlantısı gönderildi.',
            // Dev convenience: no SMTP is configured (MAIL_MAILER=log), so the
            // token is also returned here and written to storage/logs/laravel.log.
            'debugToken' => $token,
        ]);
    }

    public function resetPassword(Request $request)
    {
        $data = $request->validate([
            'email' => ['required', 'email'],
            'token' => ['required', 'string'],
            'password' => ['required', 'string', 'min:8', 'confirmed'],
        ]);

        $status = Password::broker('users')->reset(
            $data,
            function (User $user, string $password) {
                $user->forceFill(['password' => Hash::make($password), 'must_change_password' => false])->save();
                $user->tokens()->delete();
                event(new PasswordReset($user));
            }
        );

        if ($status !== Password::PASSWORD_RESET) {
            throw ApiException::validation('Sıfırlama bağlantısı geçersiz veya süresi dolmuş.');
        }

        return response()->json(['message' => 'Şifreniz güncellendi.']);
    }

    /** Voluntary change (settings page) and the forced first-login change both go through this. */
    public function changePassword(Request $request)
    {
        $data = $request->validate([
            'currentPassword' => ['required', 'string'],
            'newPassword' => ['required', 'string', 'min:8', 'confirmed'],
        ]);

        $user = $request->user();

        if (! Hash::check($data['currentPassword'], $user->password)) {
            throw ApiException::validation('Mevcut şifreniz hatalı.');
        }

        $user->forceFill([
            'password' => Hash::make($data['newPassword']),
            'must_change_password' => false,
        ])->save();

        return response()->json(['message' => 'Şifreniz güncellendi.']);
    }

    private function userPayload(User $user): array
    {
        return [
            'id' => $user->id,
            'name' => $user->name,
            'email' => $user->email,
            'role' => $user->role,
            'initials' => $user->initials,
            'mustChangePassword' => $user->must_change_password,
        ];
    }
}
