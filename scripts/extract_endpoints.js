
const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../src/config/swagger.ts');
const fileContent = fs.readFileSync(filePath, 'utf8');

// Regex to find paths and methods
// Looking for:   "/api/v1/...": {
// Followed eventually by:     get: {
const lines = fileContent.split('\n');
const endpoints = [];
let currentPath = null;

const pathRegex = /^\s*"(\/api\/[^"]+)":\s*{/;
const methodRegex = /^\s*(get|post|put|patch|delete):\s*{/;

lines.forEach(line => {
    const pathMatch = line.match(pathRegex);
    if (pathMatch) {
        currentPath = pathMatch[1];
    } else if (currentPath) {
        const methodMatch = line.match(methodRegex);
        if (methodMatch) {
            endpoints.push({
                path: currentPath,
                method: methodMatch[1]
            });
        } else if (line.trim() === '},') {
             // Heuristic: closing brace for path object? 
             // Not unreliable, but good enough for now. 
             // Actually, methods are nested.
             // If we see a new path, the old one is done.
        }
    }
});

console.log(JSON.stringify(endpoints, null, 2));
