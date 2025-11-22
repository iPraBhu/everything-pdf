const fs = require('fs');
const path = require('path');

// Read the original pdfWorker.ts file
const pdfWorkerPath = path.join(__dirname, 'src', 'workers', 'pdfWorker.ts');
const newMethodsPath = path.join(__dirname, 'src', 'workers', 'pdfWorker-new-methods.ts');

const pdfWorkerContent = fs.readFileSync(pdfWorkerPath, 'utf8');
const newMethodsContent = fs.readFileSync(newMethodsPath, 'utf8');

// Extract just the method implementations (remove the comments at the top)
const methodsToAdd = newMethodsContent
    .split('\n')
    .filter((line, index) => index > 2) // Skip first 3 comment lines
    .join('\n');

// Find the position to insert (before the closing brace of the class)
const insertPosition = pdfWorkerContent.lastIndexOf('}\n\nexpose(new PDFWorker())');

if (insertPosition === -1) {
    console.error('Could not find insertion point in pdfWorker.ts');
    process.exit(1);
}

// Insert the new methods
const updatedContent =
    pdfWorkerContent.slice(0, insertPosition) +
    '\n' + methodsToAdd + '\n' +
    pdfWorkerContent.slice(insertPosition);

// Write the updated content
fs.writeFileSync(pdfWorkerPath, updatedContent, 'utf8');

console.log('Successfully integrated new methods into pdfWorker.ts');
