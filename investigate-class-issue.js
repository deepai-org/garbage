const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');
const fs = require('fs');

const code = fs.readFileSync('./src/parser.ts', 'utf8');
const lines = code.split('\n');

// Extract just the Parser class for testing
let classCode = '';
let inClass = false;
let braceCount = 0;

for (let i = 0; i < Math.min(350, lines.length); i++) {
  const line = lines[i];
  
  if (line.includes('export class Parser')) {
    inClass = true;
  }
  
  if (inClass) {
    classCode += line + '\n';
    
    for (let char of line) {
      if (char === '{') braceCount++;
      if (char === '}') {
        braceCount--;
        if (braceCount === 0) {
          inClass = false;
          break;
        }
      }
    }
  }
}

console.log('Testing Parser class parsing (first 350 lines):\n');

const lexer = new Lexer(classCode);
const tokens = lexer.tokenize();
const parser = new Parser(tokens);
const ast = parser.parse();

// Find the class
let classDecl = null;
for (let node of ast.body) {
  if (node.kind === 'ExportDecl' && node.declaration?.kind === 'ClassDecl') {
    classDecl = node.declaration;
  } else if (node.kind === 'ClassDecl') {
    classDecl = node;
  }
}

if (classDecl) {
  console.log(`Found class with ${classDecl.members?.length || 0} members`);
  
  // Show last few members
  const members = classDecl.members || [];
  console.log('\nLast 3 members:');
  members.slice(-3).forEach((m, i) => {
    const name = m.name?.name || m.kind || 'Unknown';
    console.log(`  ${members.length - 3 + i}: ${name}`);
  });
} else {
  console.log('No class found');
}

console.log(`\nParse errors: ${parser.errors.length}`);
if (parser.errors.length > 0) {
  console.log('First 10 errors:');
  parser.errors.slice(0, 10).forEach(e => {
    const lineNum = e.token?.line || 0;
    const codeLine = classCode.split('\n')[lineNum - 1] || '';
    console.log(`  Line ${lineNum}: ${e.message}`);
    console.log(`    Token: "${e.token.value}"`);
    console.log(`    Code: ${codeLine.trim().substring(0, 50)}`);
  });
}