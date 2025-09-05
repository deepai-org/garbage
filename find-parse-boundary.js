const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');
const fs = require('fs');

const code = fs.readFileSync('./src/parser.ts', 'utf8');
const lines = code.split('\n');

// Find all private methods
const methods = [];
for (let i = 0; i < lines.length; i++) {
  if (lines[i].match(/^\s*private\s+\w+\s*\(/)) {
    const name = lines[i].match(/private\s+(\w+)\s*\(/)?.[1];
    if (name) {
      methods.push({ line: i + 1, name });
    }
  }
}

console.log(`Total private methods in parser.ts: ${methods.length}\n`);

// Parse and find how many members we get
const lexer = new Lexer(code);
const tokens = lexer.tokenize();
const parser = new Parser(tokens);
const ast = parser.parse();

let memberCount = 0;
let lastParsedMethod = null;

for (let node of ast.body) {
  if (node.kind === 'ExportDecl' && node.declaration?.kind === 'ClassDecl') {
    if (node.declaration.name?.name === 'Parser') {
      memberCount = node.declaration.members?.length || 0;
      if (node.declaration.members && node.declaration.members.length > 0) {
        const lastMember = node.declaration.members[node.declaration.members.length - 1];
        lastParsedMethod = lastMember.name?.name;
      }
      break;
    }
  }
}

console.log(`Successfully parsed ${memberCount} class members`);
console.log(`Last parsed method: ${lastParsedMethod}\n`);

// Find which method should come next
let nextMethodIndex = -1;
for (let i = 0; i < methods.length; i++) {
  if (methods[i].name === lastParsedMethod) {
    nextMethodIndex = i + 1;
    break;
  }
}

if (nextMethodIndex >= 0 && nextMethodIndex < methods.length) {
  console.log(`Next method should be: ${methods[nextMethodIndex].name} at line ${methods[nextMethodIndex].line}`);
  console.log(`\nCode at that line:`);
  console.log(`  ${lines[methods[nextMethodIndex].line - 1]}`);
} else {
  console.log('Could not determine next method');
}

// Show parse completion percentage
const parsePercentage = ((memberCount / methods.length) * 100).toFixed(1);
console.log(`\nParse completion: ${memberCount}/${methods.length} methods (${parsePercentage}%)`);