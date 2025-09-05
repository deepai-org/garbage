const fs = require('fs');

const code = fs.readFileSync('./src/parser.ts', 'utf8');
const lines = code.split('\n');

// Find patterns that look like object literals at statement level
console.log('=== Potential object literal statements ===\n');

const patterns = [];

lines.forEach((line, i) => {
  const trimmed = line.trim();
  
  // Look for patterns like "{ kind:" or "{ type:" at start of line or after control flow
  if (trimmed.match(/^(return\s+)?{$/) || 
      trimmed.match(/^\s*{\s*(kind|type|name|value)\s*:/)) {
    patterns.push({
      line: i + 1,
      content: trimmed.substring(0, 80),
      nextLine: lines[i + 1]?.trim().substring(0, 60)
    });
  }
});

console.log(`Found ${patterns.length} potential object literal patterns\n`);

patterns.slice(0, 10).forEach(p => {
  console.log(`Line ${p.line}: ${p.content}`);
  if (p.nextLine) {
    console.log(`  Next: ${p.nextLine}`);
  }
  console.log();
});

// Look for specific problematic pattern
console.log('=== Checking error recovery blocks ===\n');

let inErrorRecovery = false;
let errorBlocks = [];

lines.forEach((line, i) => {
  if (line.includes('catch (error)') || line.includes('catch(error)')) {
    inErrorRecovery = true;
    errorBlocks.push({ start: i + 1, lines: [] });
  } else if (inErrorRecovery) {
    if (line.includes('}') && !line.includes('{')) {
      inErrorRecovery = false;
    } else if (errorBlocks.length > 0) {
      const currentBlock = errorBlocks[errorBlocks.length - 1];
      if (currentBlock.lines.length < 10) {
        currentBlock.lines.push({ line: i + 1, content: line });
      }
    }
  }
});

console.log(`Found ${errorBlocks.length} error recovery blocks\n`);

// Check first few
errorBlocks.slice(0, 3).forEach((block, idx) => {
  console.log(`Error block ${idx + 1} starting at line ${block.start}:`);
  block.lines.slice(0, 5).forEach(l => {
    if (l.content.trim()) {
      console.log(`  ${l.line}: ${l.content.trim().substring(0, 70)}`);
    }
  });
  console.log();
});