import os
import re
from pathlib import Path

def test_no_orm_queries_in_serializers():
    """
    Zero N+1 Policy: Un Serializer o SerializerMethodField NUNCA ejecuta queries ORM.
    Este test realiza un análisis estático simple (grep) en todos los archivos *serializers.py.
    """
    backend_dir = Path(__file__).resolve().parent.parent.parent
    
    # Expresión regular para detectar llamadas directas al ORM que causan N+1 o mutaciones.
    # Se ignoran líneas comentadas.
    orm_pattern = re.compile(r'^\s*(?!#).*?\.objects\.(filter|get|create|exclude|aggregate|annotate)\(')
    
    violations = []
    
    for root, dirs, files in os.walk(backend_dir):
        if 'venv' in root or '.git' in root or '__pycache__' in root or '/tests' in root or '\\tests' in root:
            continue
            
        for file in files:
            if (file.endswith('serializers.py') or file.endswith('_serializers.py')) and not file.startswith('test_'):
                file_path = os.path.join(root, file)
                
                with open(file_path, 'r', encoding='utf-8') as f:
                    for line_num, line in enumerate(f, 1):
                        if orm_pattern.search(line):
                            rel_path = os.path.relpath(file_path, backend_dir)
                            violations.append(f"{rel_path}:{line_num} -> {line.strip()}")
                            
    assert not violations, (
        "Violación de Política 'Zero N+1'. Se encontraron llamadas directas al ORM en los serializers:\n" +
        "\n".join(violations) +
        "\n\nRefactorice usando prefetch_related/select_related en el ViewSet o mueva la lógica a services.py."
    )
