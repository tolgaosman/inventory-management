#!/bin/bash
set -e

# Run composer install if vendor doesn't exist
if [ ! -d "vendor" ]; then
    composer install --no-interaction --optimize-autoloader
fi

# Make sure permissions are correct
chown -R www-data:www-data /var/www/html/storage /var/www/html/bootstrap/cache

# Generate an app key if none is set, otherwise every request that touches
# encryption (signed URLs, cookies, etc.) fails and php-fpm looks "down" to nginx.
if [ -f .env ] && ! grep -q "^APP_KEY=base64:" .env; then
    php artisan key:generate --force
fi

# Wait for MySQL. Deliberately uses PHP's pdo_mysql (the driver Laravel itself
# uses) instead of `mysqladmin ping`: the mysqladmin/mariadb-client shipped via
# default-mysql-client can hang indefinitely against MySQL 8's default
# caching_sha2_password auth plugin, which silently wedges this whole script
# (and the container never gets to `exec php-fpm`, so nginx sees a dead upstream).
echo "Waiting for database connection..."
tries=0
until php -r '
    try {
        new PDO("mysql:host=" . getenv("DB_HOST") . ";port=" . getenv("DB_PORT"), getenv("DB_USERNAME"), getenv("DB_PASSWORD"));
    } catch (PDOException $e) {
        fwrite(STDERR, $e->getMessage() . PHP_EOL);
        exit(1);
    }
'; do
    tries=$((tries + 1))
    if [ "$tries" -ge 60 ]; then
        echo "Could not connect to the database after 60s, giving up." >&2
        exit 1
    fi
    sleep 1
done

echo "Database is up - executing migrations"
php artisan migrate --force

echo "Clearing caches..."
php artisan cache:clear
php artisan config:clear
php artisan route:clear
php artisan view:clear

exec "$@"
