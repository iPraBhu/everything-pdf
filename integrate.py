import re

# Read the original file
with open('src/workers/pdfWorker.ts', 'r', encoding='utf-8') as f:
    content = f.read()

# Read the new methods
with open('src/workers/pdfWorker-new-methods.ts', 'r', encoding='utf-8') as f:
    new_methods_content = f.read()

# Extract just the methods (skip first 3 comment lines)
new_methods_lines = new_methods_content.split('\n')[3:]
new_methods = '\n'.join(new_methods_lines)

# Find the position to insert (before "}\n\nexpose(new PDFWorker())")
pattern = r'(\}\s*\n\s*expose\(new PDFWorker\(\)\))'
match = re.search(pattern, content)

if match:
    insert_pos = match.start()
    # Insert the new methods
    updated_content = content[:insert_pos] + '\n' + new_methods + '\n' + content[insert_pos:]
    
    # Write the updated content
    with open('src/workers/pdfWorker.ts', 'w', encoding='utf-8') as f:
        f.write(updated_content)
    
    print('✓ Successfully added 8 new methods to pdfWorker.ts')
else:
    print('ERROR: Could not find insertion point')
