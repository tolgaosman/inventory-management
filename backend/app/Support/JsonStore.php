<?php

namespace App\Support;

use Throwable;

/**
 * File-backed replacement for a database. Each "table" is a JSON array of
 * associative rows living at storage/app/data/{collection}.json. There is no
 * Eloquent/SQL involved anywhere in this app by design (see project plan).
 *
 * transaction() gives call sites the same guarantee a DB transaction would:
 * if the callback throws, every collection touched during the callback is
 * rolled back to its pre-transaction contents. This matters for flows like
 * receiving a purchase order, which writes to stock_levels, stock_movements
 * and purchase_orders together.
 */
class JsonStore
{
    private const COLLECTIONS = [
        'warehouses', 'categories', 'suppliers', 'users', 'products',
        'stock_levels', 'stock_movements', 'purchase_orders', 'settings',
        'idempotency_keys', 'tokens',
    ];

    private static ?int $transactionDepth = 0;

    public function dataDir(): string
    {
        return storage_path('app/data');
    }

    private function path(string $collection): string
    {
        return $this->dataDir().DIRECTORY_SEPARATOR.$collection.'.json';
    }

    private function lockPath(): string
    {
        return $this->dataDir().DIRECTORY_SEPARATOR.'.lock';
    }

    public function ensureBootstrapped(): void
    {
        if (! is_dir($this->dataDir())) {
            mkdir($this->dataDir(), 0777, true);
        }
        if (! file_exists($this->path('warehouses'))) {
            app(\Database\Seeders\DemoDataSeeder::class)->run();
        }
    }

    /** @return array<int, array<string, mixed>> */
    public function read(string $collection): array
    {
        $this->ensureBootstrapped();
        $path = $this->path($collection);
        if (! file_exists($path)) {
            return [];
        }

        $handle = fopen($path, 'r');
        if ($handle === false) {
            return [];
        }
        flock($handle, LOCK_SH);
        $contents = stream_get_contents($handle);
        flock($handle, LOCK_UN);
        fclose($handle);

        if ($contents === '' || $contents === false) {
            return [];
        }

        return json_decode($contents, true) ?? [];
    }

    /**
     * @param array<int, array<string, mixed>>|array<string, mixed> $rows
     *
     * `settings` is a single associative object, not a list of rows — every
     * other collection is a list, so only re-index when $rows actually is one.
     * (array_values() unconditionally would silently drop settings' keys.)
     */
    public function write(string $collection, array $rows): void
    {
        if (! is_dir($this->dataDir())) {
            mkdir($this->dataDir(), 0777, true);
        }
        $path = $this->path($collection);
        $tmp = $path.'.tmp';
        $encoded = array_is_list($rows) ? array_values($rows) : $rows;
        file_put_contents($tmp, json_encode($encoded, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
        rename($tmp, $path);
    }

    /**
     * Run $fn with a snapshot-based rollback safety net. Nestable — only the
     * outermost call actually snapshots/locks.
     *
     * @template T
     * @param callable(self): T $fn
     * @return T
     */
    public function transaction(callable $fn)
    {
        if (! is_dir($this->dataDir())) {
            mkdir($this->dataDir(), 0777, true);
        }

        $isOutermost = self::$transactionDepth === 0;
        self::$transactionDepth++;

        $lockHandle = null;
        $snapshot = [];

        if ($isOutermost) {
            $lockHandle = fopen($this->lockPath(), 'c');
            flock($lockHandle, LOCK_EX);

            foreach (self::COLLECTIONS as $collection) {
                $path = $this->path($collection);
                $snapshot[$collection] = file_exists($path) ? file_get_contents($path) : null;
            }
        }

        try {
            $result = $fn($this);

            if ($isOutermost) {
                flock($lockHandle, LOCK_UN);
                fclose($lockHandle);
            }
            self::$transactionDepth--;

            return $result;
        } catch (Throwable $e) {
            if ($isOutermost) {
                foreach ($snapshot as $collection => $contents) {
                    $path = $this->path($collection);
                    if ($contents === null) {
                        if (file_exists($path)) {
                            unlink($path);
                        }
                    } else {
                        file_put_contents($path, $contents);
                    }
                }
                flock($lockHandle, LOCK_UN);
                fclose($lockHandle);
            }
            self::$transactionDepth--;

            throw $e;
        }
    }

    /**
     * Generate the next sequential id for a collection, e.g. nextId($rows, 'prd', 4) => "prd-0273".
     */
    public function nextId(array $rows, string $prefix, int $pad = 4): string
    {
        $max = 0;
        foreach ($rows as $row) {
            $id = $row['id'] ?? '';
            if (preg_match('/^'.preg_quote($prefix, '/').'-(\d+)$/', $id, $m)) {
                $max = max($max, (int) $m[1]);
            }
        }

        return sprintf('%s-%0'.$pad.'d', $prefix, $max + 1);
    }
}
