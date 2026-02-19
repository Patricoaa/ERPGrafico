#!/bin/sh

set -e

if [ "$SKIP_MIGRATIONS" != "true" ]; then
    echo "Waiting for database to be ready..."
    until pg_isready -h "${DB_HOST:-db}" -U "${POSTGRES_USER:-postgres}" -q; do
        echo "  Database not ready, retrying in 2s..."
        sleep 2
    done
    echo "Database is ready. Applying migrations..."
    python manage.py migrate
fi

echo "Starting server..."
exec "$@"
