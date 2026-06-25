import os
import re

for root, dirs, files in os.walk('backend/treasury/tests'):
    for file in files:
        if file.endswith('.py'):
            path = os.path.join(root, file)
            with open(path, 'r') as f:
                content = f.read()

            # Replace Contact.objects.create(
            # with Contact.objects.create(tax_id="12345678-9",
            # ONLY if it doesn't already have tax_id
            
            # Using a simple logic: we split by Contact.objects.create(
            parts = content.split('Contact.objects.create(')
            if len(parts) > 1:
                new_content = parts[0]
                for p in parts[1:]:
                    # check if tax_id= is in the next 150 chars
                    if 'tax_id=' not in p[:150]:
                        new_content += 'Contact.objects.create(tax_id="12345678-9", ' + p
                    else:
                        new_content += 'Contact.objects.create(' + p
                        
                with open(path, 'w') as f:
                    f.write(new_content)
