const fs = require('fs');
const lines = fs.readFileSync('lint_output.txt', 'utf-8').split('\n');
let currentFile = '';
for (let line of lines) {
    if (line.startsWith('/')) {
        currentFile = line;
    } else if (line.includes('error')) {
        if (!line.includes('set-state-in-effect')) {
            console.log(currentFile);
            console.log(line);
        }
    }
}
