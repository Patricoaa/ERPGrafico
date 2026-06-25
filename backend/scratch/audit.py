import os
import ast

def analyze_backend(base_dir):
    apps = [d for d in os.listdir(base_dir) if os.path.isdir(os.path.join(base_dir, d)) and not d.startswith('.') and d not in ['venv', 'tmp', 'scratch', 'scripts', 'media', 'config']]
    
    print(f"Found apps: {apps}")
    print("="*50)
    print("CHECKING VIEWS (>20 lines rule)")
    print("="*50)
    
    for app in apps:
        path = os.path.join(base_dir, app, 'views.py')
        if os.path.exists(path):
            with open(path, 'r') as f:
                content = f.read()
            try:
                tree = ast.parse(content)
                for node in ast.walk(tree):
                    if isinstance(node, ast.FunctionDef):
                        lines = node.end_lineno - node.lineno
                        if lines > 20:
                            print(f"[{app}/views.py] {node.name} is {lines} lines long")
            except Exception as e:
                print(f"Error parsing {path}: {e}")

    print("\n" + "="*50)
    print("CHECKING CROSS-APP IMPORTS IN SERIALIZERS")
    print("="*50)
    
    for app in apps:
        path = os.path.join(base_dir, app, 'serializers.py')
        if os.path.exists(path):
            with open(path, 'r') as f:
                lines = f.readlines()
            for line_no, line in enumerate(lines, 1):
                if line.strip().startswith('from ') or line.strip().startswith('import '):
                    # very basic check
                    for other_app in apps:
                        if other_app != app and other_app != 'core':
                            if f"from {other_app}" in line or f"import {other_app}" in line:
                                print(f"[{app}/serializers.py:{line_no}] imports from {other_app}: {line.strip()}")

    print("\n" + "="*50)
    print("CHECKING BUSINESS LOGIC IN VIEWS (has attr .save() or .create())")
    print("="*50)
    for app in apps:
        path = os.path.join(base_dir, app, 'views.py')
        if os.path.exists(path):
            with open(path, 'r') as f:
                lines = f.readlines()
            for line_no, line in enumerate(lines, 1):
                if '.save(' in line and 'serializer.save' not in line:
                    print(f"[{app}/views.py:{line_no}] direct .save(): {line.strip()}")
                if 'objects.create(' in line:
                    print(f"[{app}/views.py:{line_no}] direct objects.create(): {line.strip()}")

if __name__ == '__main__':
    analyze_backend('/home/pato/Nextcloud/Pato/Aplicaciones/ERPGrafico/backend')
