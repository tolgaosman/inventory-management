<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\File;
use Symfony\Component\Process\Process;

/**
 * Local/self-host backup: dumps the configured MySQL database to a
 * timestamped, gzipped file under storage/app/backups and prunes anything
 * older than --keep-days. Scheduled daily in routes/console.php. For a real
 * cloud deployment this should also push the file off-site (S3, etc.) — not
 * wired up here since no cloud storage is provisioned yet.
 */
class BackupDatabase extends Command
{
    protected $signature = 'backup:database {--keep-days=14 : Delete backups older than this many days}';

    protected $description = 'Dump the database to storage/app/backups/ and prune old backups';

    public function handle(): int
    {
        if (config('database.default') !== 'mysql') {
            $this->error('backup:database only supports the mysql connection (DB_CONNECTION=mysql).');

            return self::FAILURE;
        }

        $connection = config('database.connections.mysql');
        $dir = storage_path('app/backups');
        File::ensureDirectoryExists($dir);

        $filename = 'backup_'.now()->format('Y-m-d_His').'.sql.gz';
        $path = $dir.DIRECTORY_SEPARATOR.$filename;

        $mysqldump = $this->resolveMysqldumpBinary();
        if (! $mysqldump) {
            $this->error('mysqldump binary not found. Set MYSQLDUMP_PATH in .env to its full path.');

            return self::FAILURE;
        }

        $command = [
            $mysqldump,
            '--host='.$connection['host'],
            '--port='.$connection['port'],
            '--user='.$connection['username'],
            '--single-transaction',
            '--skip-lock-tables',
            $connection['database'],
        ];

        $process = new Process($command, env: $connection['password'] !== '' ? ['MYSQL_PWD' => $connection['password']] : []);
        $process->setTimeout(300);
        $process->run();

        if (! $process->isSuccessful()) {
            $this->error('mysqldump failed: '.$process->getErrorOutput());

            return self::FAILURE;
        }

        file_put_contents($path, gzencode($process->getOutput(), 9));
        $this->info("Backup written: {$path} (".$this->humanSize(filesize($path)).')');

        $this->pruneOldBackups($dir, (int) $this->option('keep-days'));

        return self::SUCCESS;
    }

    private function resolveMysqldumpBinary(): ?string
    {
        $configured = env('MYSQLDUMP_PATH');
        if ($configured && is_executable($configured)) {
            return $configured;
        }

        // Common XAMPP location on Windows dev machines, as a convenience
        // fallback when MYSQLDUMP_PATH isn't set.
        $xamppDefault = 'C:\\xampp\\mysql\\bin\\mysqldump.exe';
        if (is_executable($xamppDefault)) {
            return $xamppDefault;
        }

        // Otherwise hope it's on PATH (typical on Linux/macOS servers).
        return 'mysqldump';
    }

    private function pruneOldBackups(string $dir, int $keepDays): void
    {
        $cutoff = now()->subDays($keepDays)->timestamp;
        $pruned = 0;

        foreach (File::files($dir) as $file) {
            if ($file->getMTime() < $cutoff) {
                File::delete($file->getPathname());
                $pruned++;
            }
        }

        if ($pruned > 0) {
            $this->info("Pruned {$pruned} backup(s) older than {$keepDays} day(s).");
        }
    }

    private function humanSize(int $bytes): string
    {
        return $bytes > 1024 * 1024
            ? round($bytes / (1024 * 1024), 1).' MB'
            : round($bytes / 1024, 1).' KB';
    }
}
