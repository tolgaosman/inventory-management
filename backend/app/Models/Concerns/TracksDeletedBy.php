<?php

namespace App\Models\Concerns;

/**
 * SoftDeletes::delete() persists only `deleted_at` (and `updated_at`) via a
 * targeted UPDATE — it does not save other dirty attributes, so setting
 * `deleted_by` before calling delete() silently gets dropped. These helpers
 * do the soft-delete first, then a follow-up save for `deleted_by`.
 */
trait TracksDeletedBy
{
    public function deleteAs(string $userId): bool
    {
        $result = $this->delete();
        $this->forceFill(['deleted_by' => $userId])->saveQuietly();

        return $result;
    }

    public function restoreTracked(): bool
    {
        $this->deleted_by = null;

        return $this->restore();
    }
}
