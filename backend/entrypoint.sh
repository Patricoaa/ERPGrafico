#!/bin/sh

# Exit immediately if a command exits with a non-zero status.
set -e

if [ "$SKIP_MIGRATIONS" != "true" ]; then
    echo "Applying database migrations..."
    python manage.py migrate
fi

echo "Starting server..."
exec "$@"
