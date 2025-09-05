const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');
const fs = require('fs');

const code = fs.readFileSync('./src/parser.ts', 'utf8');
const lines = code.split('\n');

// Find all lines with 'case' to understand context
console.log('=== Lines containing "case" ===\n');

let caseLines = [];
lines.forEach((line, i) => {
  if (line.includes('case ')) {
    caseLines.push({ line: i + 1, content: line.trim() });
  }
});

// Group by pattern
const patterns = {
  'switch_case': [],
  'comment': [],
  'string': [],
  'other': []
};

caseLines.forEach(({ line, content }) => {
  if (content.startsWith('//') || content.startsWith('*')) {
    patterns.comment.push({ line, content });
  } else if (content.includes('case "') || content.includes("case '")) {
    patterns.switch_case.push({ line, content });
  } else if (content.includes('"case') || content.includes("'case")) {
    patterns.string.push({ line, content });
  } else {
    patterns.other.push({ line, content });
  }
});

console.log(`Found ${caseLines.length} lines with 'case'\n`);

console.log('Switch case statements:', patterns.switch_case.length);
patterns.switch_case.slice(0, 5).forEach(item => {
  console.log(`  Line ${item.line}: ${item.content.substring(0, 60)}`);
});

console.log('\nOther patterns:', patterns.other.length);
patterns.other.slice(0, 5).forEach(item => {
  console.log(`  Line ${item.line}: ${item.content.substring(0, 60)}`);
});

// Now check what's happening with these case statements
console.log('\n=== Testing case statement parsing ===\n');

// Find a problematic case
const problematicLine = 4576; // Line with case "ChanType":
const startLine = problematicLine - 5;
const endLine = problematicLine + 5;

const testCode = lines.slice(startLine - 1, endLine).join('\n');
console.log('Code context:');
console.log(testCode);

// Check if we're inside a switch statement
const methodStart = lines.slice(0, problematicLine).reverse().findIndex(line => 
  line.includes('private ') || line.includes('public ') || line.includes('protected '));

if (methodStart !== -1) {
  const methodLine = problematicLine - methodStart - 1;
  console.log(`\nMethod starts at line ${methodLine}: ${lines[methodLine - 1].trim().substring(0, 60)}`);
  
  // Check for switch statement
  for (let i = methodLine; i < problematicLine; i++) {
    if (lines[i - 1].includes('switch')) {
      console.log(`Switch statement at line ${i}: ${lines[i - 1].trim()}`);
      break;
    }
  }
}