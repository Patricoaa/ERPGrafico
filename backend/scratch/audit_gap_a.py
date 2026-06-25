import os
import ast

def analyze_gap_a(base_dir, output_file):
    apps = [d for d in os.listdir(base_dir) if os.path.isdir(os.path.join(base_dir, d)) and not d.startswith('.') and d not in ['venv', 'tmp', 'scratch', 'scripts', 'media', 'config']]
    
    with open(output_file, 'w') as out:
        out.write("# GAP A Violations Sweep\n\n")
        out.write("## 1. Vistas con más de 20 líneas\n\n")
        
        total_long = 0
        for app in apps:
            path = os.path.join(base_dir, app, 'views.py')
            if os.path.exists(path):
                with open(path, 'r') as f:
                    content = f.read()
                try:
                    tree = ast.parse(content)
                    app_violations = []
                    for node in ast.walk(tree):
                        if isinstance(node, ast.FunctionDef):
                            lines = node.end_lineno - node.lineno
                            if lines > 20:
                                app_violations.append((node.name, lines))
                                total_long += 1
                    if app_violations:
                        out.write(f"### {app}\n")
                        for name, lines in app_violations:
                            out.write(f"- `{name}`: {lines} líneas\n")
                except Exception as e:
                    pass

        out.write(f"\n*Total de vistas largas: {total_long}*\n")
        out.write("\n## 2. Lógica de negocio directa en vistas (`.save()`, `objects.create()`)\n\n")
        
        total_logic = 0
        for app in apps:
            path = os.path.join(base_dir, app, 'views.py')
            if os.path.exists(path):
                with open(path, 'r') as f:
                    lines = f.readlines()
                app_violations = []
                for line_no, line in enumerate(lines, 1):
                    # check for common explicit business logic
                    if '.save(' in line and 'serializer.save' not in line:
                        app_violations.append((line_no, line.strip()))
                        total_logic += 1
                    if 'objects.create(' in line:
                        app_violations.append((line_no, line.strip()))
                        total_logic += 1
                if app_violations:
                    out.write(f"### {app}\n")
                    for line_no, line in app_violations:
                        out.write(f"- Línea {line_no}: `{line}`\n")
        out.write(f"\n*Total de violaciones lógicas directas detectadas: {total_logic}*\n")

if __name__ == '__main__':
    analyze_gap_a('/home/pato/Nextcloud/Pato/Aplicaciones/ERPGrafico/backend', '/home/pato/Nextcloud/Pato/Aplicaciones/ERPGrafico/backend/scratch/gap_a_report.md')
