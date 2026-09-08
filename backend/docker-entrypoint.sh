#!/bin/bash
set -e

# Run composer install if vendor doesn't exist
if [ ! -d "vendor" ]; then
    composer install --no-interaction --optimize-autoloader
fi

# Make sure permissions are correct
chown -R www-data:www-data /var/www/html/storage /var/www/html/bootstrap/cache

# Wait for MySQL
echo "Waiting for database connection..."
while ! mysqladmin ping -h"$DB_HOST" --silent; do
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
