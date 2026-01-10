import os
import django
from django.db import connection

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

def check_table(table_name):
    print(f"\n--- Table: {table_name} ---")
    with connection.cursor() as cursor:
        cursor.execute(f"SELECT column_name, is_nullable, column_default FROM information_schema.columns WHERE table_name = '{table_name}' ORDER BY ordinal_position")
        rows = cursor.fetchall()
        for row in rows:
            print(row)

if __name__ == "__main__":
    check_table('inventory_replenishmentproposal')
    check_table('inventory_stockmove')
    check_table('inventory_reorderingrule')
