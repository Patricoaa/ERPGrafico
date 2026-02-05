
import os
import django
import sys

# Setup Django
sys.path.append(os.path.join(os.getcwd(), 'backend'))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from django.db import connection

def check_schema():
    cursor = connection.cursor()
    cursor.execute("PRAGMA table_info(treasury_payment)")
    columns = cursor.fetchall()
    print("Columns in treasury_payment:")
    for col in columns:
        # col[1] is name, col[3] is notnull
        print(f"Name: {col[1]}, NotNull: {col[3]}")

if __name__ == "__main__":
    check_schema()
