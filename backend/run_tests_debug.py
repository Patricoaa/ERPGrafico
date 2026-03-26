import os
import django
import sys

# Setup django environment
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings') # Changed core to config as per celery-worker command
django.setup()

from django.test.utils import get_runner
from django.conf import settings

def run_tests():
    TestRunner = get_runner(settings)
    test_runner = TestRunner(verbosity=2, interactive=False)
    failures = test_runner.run_tests(['accounting.test_account_hierarchy.AccountHierarchyTest'])
    sys.exit(bool(failures))

if __name__ == "__main__":
    run_tests()
