#!/bin/sh

set -e

if [ "$SKIP_MIGRATIONS" != "true" ]; then
    echo "Waiting for database to be ready..."
    
    # Si usamos DATABASE_URL (Cloud), validamos con python
    if [ -n "$DATABASE_URL" ]; then
        until python -c "import os; import psycopg2; psycopg2.connect(os.environ['DATABASE_URL'])" > /dev/null 2>&1; do
            echo "  Cloud Database not ready, retrying in 2s..."
            sleep 2
        done
    else
        # Si no, usamos el chequeo clásico de Docker local
        until pg_isready -h "${DB_HOST:-db}" -U "${POSTGRES_USER:-postgres}" -q; do
            echo "  Local Database not ready, retrying in 2s..."
            sleep 2
        done
    fi
    echo "Database is ready. Applying migrations..."
    python manage.py migrate
fi

echo "Starting server..."
exec "$@"
