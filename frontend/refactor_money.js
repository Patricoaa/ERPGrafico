const fs = require('fs');
const path = require('path');

function walkDir(dir, callback) {
    fs.readdirSync(dir).forEach(f => {
        let dirPath = path.join(dir, f);
        let isDirectory = fs.statSync(dirPath).isDirectory();
        if (isDirectory) {
            walkDir(dirPath, callback);
        } else if (dirPath.endsWith('.ts') || dirPath.endsWith('.tsx')) {
            callback(path.join(dirPath));
        }
    });
}

walkDir('./features', processFile);
walkDir('./components', processFile);
walkDir('./app', processFile);

function processFile(filePath) {
    let content = fs.readFileSync(filePath, 'utf8');
    let original = content;

    // 1. Replace `import { formatCurrency } from "@/lib/currency"`
    content = content.replace(/import\s*\{\s*formatCurrency\s*\}\s*from\s*['"]@\/lib\/currency['"];?/g, 'import { formatCurrency } from "@/lib/money"');

    // 2. Extract formatCurrency from utils imports
    const utilsImportRegex = /import\s*\{([^}]+)\}\s*from\s*['"]@\/lib\/utils['"];?/g;
    let needsMoneyImport = false;
    
    content = content.replace(utilsImportRegex, (match, importsStr) => {
        const imports = importsStr.split(',').map(s => s.trim()).filter(Boolean);
        const formatIndex = imports.indexOf('formatCurrency');
        if (formatIndex !== -1) {
            needsMoneyImport = true;
            imports.splice(formatIndex, 1);
            if (imports.length === 0) return '';
            return `import { ${imports.join(', ')} } from "@/lib/utils"`;
        }
        return match;
    });

    if (needsMoneyImport) {
        // Check if @/lib/money is already imported
        const moneyImportRegex = /import\s*\{([^}]+)\}\s*from\s*['"]@\/lib\/money['"];?/;
        if (moneyImportRegex.test(content)) {
            content = content.replace(moneyImportRegex, (match, importsStr) => {
                const imports = importsStr.split(',').map(s => s.trim()).filter(Boolean);
                if (!imports.includes('formatCurrency')) {
                    imports.push('formatCurrency');
                }
                return `import { ${imports.join(', ')} } from "@/lib/money"`;
            });
        } else {
            // Add import to the top block
            content = `import { formatCurrency } from "@/lib/money"\n` + content;
        }
    }

    // 3. Replace direct Intl.NumberFormat
    content = content.replace(/new Intl\.NumberFormat\(\s*['"]es-CL['"]\s*,\s*\{\s*style:\s*['"]currency['"]\s*,\s*currency:\s*['"]CLP['"]\s*\}\s*\)\.format\(([^)]+)\)/g, 'formatCurrency($1)');
    content = content.replace(/new Intl\.NumberFormat\(\s*['"]es-CL['"]\s*,\s*\{\s*maximumFractionDigits:\s*0\s*\}\s*\)\.format\(([^)]+)\)/g, 'formatCurrency($1)');

    if (content !== original) {
        fs.writeFileSync(filePath, content);
    }
}
