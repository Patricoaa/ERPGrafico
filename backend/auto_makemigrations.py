
import subprocess
import sys

# Try to run makemigrations and automatically answer 'y' to renames
process = subprocess.Popen(
    [sys.executable, 'manage.py', 'makemigrations', 'treasury', '--name', 'unified_movement'],
    stdin=subprocess.PIPE,
    stdout=subprocess.PIPE,
    stderr=subprocess.PIPE,
    text=True,
    cwd='c:\\Users\\PATRI\\Nextcloud\\Pato\\Aplicaciones\\ERPGrafico\\backend'
)

# Send 'y\ny\ny\n' to handle multiple potential renames
stdout, stderr = process.communicate(input='y\ny\ny\ny\n')

print("STDOUT:", stdout)
print("STDERR:", stderr)
