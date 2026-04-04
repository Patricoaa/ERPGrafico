import { readdirSync, statSync, readFileSync, writeFileSync } from 'fs';
import { join, extname } from 'path';

const ROOT = '.';
const SKIP = ['node_modules', '.next', '.git'];

function walk(dir) {
  let files = [];
  for (const name of readdirSync(dir)) {
    if (SKIP.includes(name)) continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) files.push(...walk(full));
    else if (['.ts', '.tsx'].includes(extname(full))) files.push(full);
  }
  return files;
}

const IMPORT_LINE = 'import { showApiError } from "@/lib/errors"';

// Patterns: toast.error(error.response?.data?.XXX || "msg")
const SIMPLE_TOAST = /toast\.error\(\s*error\.response\?\.data\?\.\w+\s*\|\|\s*("[^"]*"|'[^']*'|`[^`]*`)\s*\)/g;
// Pattern: toast.error(error.response?.data?.XXX || error.response?.data?.YYY || "msg")
const DOUBLE_TOAST = /toast\.error\(\s*error\.response\?\.data\?\.\w+\s*\|\|\s*error\.response\?\.data\?\.\w+\s*\|\|\s*("[^"]*"|'[^']*'|`[^`]*`)\s*\)/g;
// Pattern: alert(error.response?.data?.XXX || "msg")
const SIMPLE_ALERT = /alert\(\s*error\.response\?\.data\?\.\w+\s*\|\|\s*("[^"]*"|'[^']*'|`[^`]*`)\s*\)/g;
// Pattern: error.response?.data?.error || error.response?.data?.detail || "msg" (assigned to variable)
const VAR_ASSIGN = /(const\s+\w+\s*=\s*)error\.response\?\.data\?\.\w+\s*\|\|\s*("[^"]*"|'[^']*'|`[^`]*`)/g;
const VAR_ASSIGN_DOUBLE = /(const\s+\w+\s*=\s*)error\.response\?\.data\?\.\w+\s*\|\|\s*error\.response\?\.data\?\.\w+\s*\|\|\s*("[^"]*"|'[^']*'|`[^`]*`)/g;
// Pattern: toast.error("prefix" + (error.response?.data?.detail || error.message))
const CONCAT_TOAST = /toast\.error\(\s*("[^"]*"\s*\+\s*\()error\.response\?\.data\?\.\w+\s*\|\|\s*error\.message\)\s*\)/g;
// Pattern for BankJournalForm-style alert
const ALERT_DETAIL = /alert\(\s*error\.response\?\.data\?\.\w+\s*\|\|\s*("[^"]*"|'[^']*')\s*\)/g;

let totalFixed = 0;

for (const file of walk(ROOT)) {
  let content = readFileSync(file, 'utf-8');
  let changed = false;

  // Simple toast.error(error.response?.data?.xxx || "msg")
  if (SIMPLE_TOAST.test(content)) {
    content = content.replace(SIMPLE_TOAST, (_, msg) => `showApiError(error, ${msg})`);
    changed = true;
  }
  // Double fallback pattern  
  if (DOUBLE_TOAST.test(content)) {
    content = content.replace(DOUBLE_TOAST, (_, msg) => `showApiError(error, ${msg})`);
    changed = true;
  }
  // alert patterns
  if (SIMPLE_ALERT.test(content)) {
    content = content.replace(SIMPLE_ALERT, (_, msg) => `showApiError(error, ${msg})`);
    changed = true;
  }
  // Variable assignment: const errorMsg = error.response?.data?.xxx || "msg"
  if (VAR_ASSIGN_DOUBLE.test(content)) {
    content = content.replace(VAR_ASSIGN_DOUBLE, (_, prefix, msg) => `${prefix}getErrorMessage(error) || ${msg}`);
    changed = true;
  }
  if (VAR_ASSIGN.test(content)) {
    content = content.replace(VAR_ASSIGN, (_, prefix, msg) => `${prefix}getErrorMessage(error) || ${msg}`);
    changed = true;
  }
  // Concat toast pattern
  if (CONCAT_TOAST.test(content)) {
    content = content.replace(CONCAT_TOAST, (_, prefix) => `showApiError(error, ${prefix.replace(/\s*\+\s*\($/, '')})`);
    changed = true;
  }

  if (changed) {
    // Add import if needed
    const needsShowApiError = content.includes('showApiError(');
    const needsGetErrorMessage = content.includes('getErrorMessage(');
    
    if (needsShowApiError && !content.includes('showApiError') || true) {
      // Build import
      const imports = [];
      if (needsShowApiError) imports.push('showApiError');
      if (needsGetErrorMessage) imports.push('getErrorMessage');
      
      if (imports.length > 0) {
        const importStr = `import { ${imports.join(', ')} } from "@/lib/errors"`;
        
        // Check if already imported
        if (!content.includes('from "@/lib/errors"') && !content.includes("from '@/lib/errors'")) {
          // Insert after "use client" or at top
          if (content.includes('"use client"')) {
            content = content.replace('"use client"\n\n', `"use client"\n\n${importStr}\n`);
            content = content.replace('"use client"\r\n\r\n', `"use client"\r\n\r\n${importStr}\r\n`);
          } else {
            content = importStr + '\n' + content;
          }
        } else if (content.includes('from "@/lib/errors"')) {
          // Update existing import to include new functions
          const existingMatch = content.match(/import\s*\{([^}]+)\}\s*from\s*"@\/lib\/errors"/);
          if (existingMatch) {
            const existing = existingMatch[1].split(',').map(s => s.trim());
            for (const fn of imports) {
              if (!existing.includes(fn)) existing.push(fn);
            }
            content = content.replace(
              /import\s*\{[^}]+\}\s*from\s*"@\/lib\/errors"/,
              `import { ${existing.join(', ')} } from "@/lib/errors"`
            );
          }
        }
      }
    }
    
    writeFileSync(file, content, 'utf-8');
    console.log('Fixed:', file);
    totalFixed++;
  }
}
console.log(`\nTotal fixed: ${totalFixed}`);
