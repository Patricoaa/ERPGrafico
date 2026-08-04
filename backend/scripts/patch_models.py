import re
import os

def process_file(filepath):
    if not os.path.exists(filepath):
        print(f"File {filepath} not found.")
        return

    with open(filepath, 'r') as f:
        content = f.read()
        
    # Add imports
    if 'from core.models.abstracts import TimeStampedModel' not in content:
        content = re.sub(
            r'from django\.db import models', 
            'from django.db import models\nfrom core.models.abstracts import TimeStampedModel', 
            content, 
            count=1
        )
        
    if 'from simple_history.models import HistoricalRecords' not in content:
        content = re.sub(
            r'from django\.db import models', 
            'from django.db import models\nfrom simple_history.models import HistoricalRecords', 
            content, 
            count=1
        )

    lines = content.split('\n')
    new_lines = []
    
    for i, line in enumerate(lines):
        # Mudar models.Model a TimeStampedModel
        if re.match(r'^class \w+\(models\.Model\):', line):
            line = line.replace('(models.Model)', '(TimeStampedModel)')
            
        new_lines.append(line)
        
        # Inyectar history = HistoricalRecords()
        if re.match(r'^class \w+\(TimeStampedModel\):', line):
            # Verificar si ya tiene history
            has_history = False
            for j in range(i+1, min(i+40, len(lines))):
                if re.match(r'^class ', lines[j]):
                    break
                if 'history = HistoricalRecords' in lines[j]:
                    has_history = True
                    break
            
            if not has_history:
                new_lines.append('    history = HistoricalRecords()')
                
    with open(filepath, 'w') as f:
        f.write('\n'.join(new_lines))
    print(f"Patched {filepath}")

process_file('tax/models.py')
process_file('treasury/models.py')
