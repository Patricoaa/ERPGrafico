import re
import os

path = r'c:\Users\patox\Nextcloud\Pato\Aplicaciones\ERPGrafico\frontend\features\production\components\WorkOrderWizard.tsx'

if not os.path.exists(path):
    print(f"Error: File {path} not found")
    exit(1)

with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# States
content = re.sub(r'const \[selectedProductObj, setSelectedProductObj\] = useState<any>\(null\)', 
                 'const [selectedProductObj, setSelectedProductObj] = useState<ProductMinimal | null>(null)', content)

content = re.sub(r'const \[newMaterialVariants, setNewMaterialVariants\] = useState<any\[\]>\(\[\]\)', 
                 'const [newMaterialVariants, setNewMaterialVariants] = useState<ProductMinimal[]>([])', content)

content = re.sub(r'const \[uoms, setUoMs\] = useState<any\[\]>\(\[\]\) // Store all UoMs', 
                 'const [uoms, setUoMs] = useState<UoM[]>([]) // Store all UoMs', content)

content = re.sub(r'const \[outsourcedPending, setOutsourcedPending\] = useState<any\[\]>\(\[\]\)', 
                 'const [outsourcedPending, setOutsourcedPending] = useState<WorkOrderMaterial[]>([])', content)

# pendingTasks
content = re.sub(r'const pendingTasks = order\?\.workflow_tasks\?\.filter\(\(t: any\) =\> t\.status === \'PENDING\' \|\| t\.status === \'IN_PROGRESS\'\) \|\| \[\]',
                 'const pendingTasks = order?.workflow_tasks?.filter((t: WorkOrderTask) => t.status === \'PENDING\' || t.status === \'IN_PROGRESS\') || []', content)

# canUserCompleteTask
content = re.sub(r'const canUserCompleteTask = \(task: any\) =\>',
                 'const canUserCompleteTask = (task: WorkOrderTask) =>', content)

# user.groups cast
# Original: if ((user as any)?.groups) {
# Replacement: const userGroups = (user as any)?.groups as (string | number)[] | undefined; if (userGroups) {
content = content.replace('if ((user as any)?.groups) {', 'const userGroups = (user as any)?.groups as (string | number)[] | undefined;\n        if (userGroups) {')
content = content.replace('return (user as any).groups.some((g: any) => {', 'return userGroups.some((g: string | number) => {')

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)

print("Successfully refactored WorkOrderWizard.tsx states and functions.")
