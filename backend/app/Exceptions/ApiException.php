<?php

namespace App\Exceptions;

use Exception;

/**
 * Uniform error envelope for the whole API: { "message": "...", "code": "..." }.
 * `code` mirrors the frontend's ApiError codes (frontend/lib/api/client.ts) so the
 * Turkish messages this throws are shown to the user verbatim.
 */
class ApiException extends Exception
{
    public const NOT_FOUND = 'NOT_FOUND';
    public const VALIDATION = 'VALIDATION';
    public const CONFLICT = 'CONFLICT';
    public const FORBIDDEN = 'FORBIDDEN';
    public const UNKNOWN = 'UNKNOWN';

    /** Named errorCode, not $code — Exception already declares an untyped $code and PHP forbids re-typing it. */
    public string $errorCode;

    public function __construct(
        string $message,
        string $code = self::UNKNOWN,
    ) {
        parent::__construct($message);
        $this->errorCode = $code;
    }

    public function status(): int
    {
        return match ($this->errorCode) {
            self::NOT_FOUND => 404,
            self::VALIDATION => 422,
            self::CONFLICT => 409,
            self::FORBIDDEN => 403,
            default => 500,
        };
    }

    public static function notFound(string $message): self
    {
        return new self($message, self::NOT_FOUND);
    }

    public static function validation(string $message): self
    {
        return new self($message, self::VALIDATION);
    }

    public static function conflict(string $message): self
    {
        return new self($message, self::CONFLICT);
    }

    public static function forbidden(string $message): self
    {
        return new self($message, self::FORBIDDEN);
    }
}
