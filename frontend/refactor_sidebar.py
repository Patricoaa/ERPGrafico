import os
import re

files_to_process = [
    "components/forms/BankJournalForm.tsx",
    "components/forms/UserForm.tsx",
    "components/forms/WarehouseForm.tsx",
    "components/forms/PricingRuleForm.tsx",
    "components/forms/ProductForm.tsx",
    "components/forms/AccountForm.tsx",
    "components/forms/CategoryForm.tsx",
    "components/forms/JournalEntryForm.tsx",
]

base_dir = r"c:\Users\patox\Nextcloud\Pato\Aplicaciones\ERPGrafico\frontend"

for file_path in files_to_process:
    full_path = os.path.join(base_dir, file_path)
    if not os.path.exists(full_path):
        continue
        
    with open(full_path, "r", encoding="utf-8") as f:
        content = f.read()
        
    if "ActivitySidebar" not in content:
        continue
        
    # 1. Remove import
    content = re.sub(r'import\s+{\s*ActivitySidebar\s*}\s+from\s+["\'][^"\']+["\']\r?\n?', '', content)
    
    # 2. Add React node to interface if there's an interface ending in Props
    content = re.sub(r'(interface\s+\w+Props\s*\{)', r'\1\n    auditSidebar?: React.ReactNode', content)
    
    # 3. Add to destructured params in export function
    # It usually looks like: export function BankJournalForm({ onSuccess, initialData, open: openProp, onOpenChange }: BankJournalFormProps)
    content = re.sub(r'(export\s+function\s+\w+\s*\(\s*\{)(.*?\})(\s*:\s*\w+Props\))', r'\1 auditSidebar, \2\3', content)
    
    # 4. Replace <ActivitySidebar ... /> with {auditSidebar}
    content = re.sub(r'<ActivitySidebar[^>]*/>', '{auditSidebar}', content)
    
    # 5. Make sure React is imported if needed (ReactNode is usually used without import if using React.ReactNode)
    # Most files already import React or we can just use React.ReactNode. I used React.ReactNode above.
    
    # 6. Change condition if initialData?.id && ... {auditSidebar}
    # Optional, we can just let it be initialData?.id && ( ... {auditSidebar} )
    # But replacing initialData?.id && ( with uditSidebar && ( near the sidebar is safer if we want it to hide when missing
    # Let's do a loose replacement of the direct surrounding condition if possible, or just let the empty div render if auditSidebar is null (it's fine, it adds a border, wait).
    # "initialData?.id && (" followed a few lines later by "{auditSidebar}" could be replaced.
    
    with open(full_path, "w", encoding="utf-8") as f:
        f.write(content)
        
    print(f"Processed {file_path}")

