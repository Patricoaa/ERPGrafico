import os
import re

for root, dirs, files in os.walk('backend'):
    for file in files:
        if file.endswith('.py'):
            path = os.path.join(root, file)
            with open(path, 'r') as f:
                content = f.read()

            parts = content.split('Contact.objects.create(')
            if len(parts) > 1:
                new_content = parts[0]
                for p in parts[1:]:
                    if 'tax_id=' not in p[:150]:
                        new_content += 'Contact.objects.create(tax_id="12345678-9", ' + p
                    else:
                        new_content += 'Contact.objects.create(' + p
                        
                if new_content != content:
                    with open(path, 'w') as f:
                        f.write(new_content)
