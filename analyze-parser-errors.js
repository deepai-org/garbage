const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');
const fs = require('fs');

// Parse the parser itself
const code = fs.readFileSync('./src/parser.ts', 'utf8');

console.log('Analyzing parse errors in parser.ts...\n');
const lexer = new Lexer(code);
const tokens = lexer.tokenize();
const parser = new Parser(tokens);
const ast = parser.parse();

// Group errors by message
const errorGroups = {};
parser.errors.forEach(e => {
  const key = e.message;
  if (!errorGroups[key]) {
    errorGroups[key] = [];
  }
  errorGroups[key].push(e);
});

// Sort by frequency
const sortedGroups = Object.entries(errorGroups)
  .sort((a, b) => b[1].length - a[1].length);

console.log('Error summary by type:');
console.log('========================');
sortedGroups.forEach(([message, errors]) => {
  console.log(`\n${errors.length}x: ${message}`);
  // Show first 3 examples
  errors.slice(0, 3).forEach(e => {
    console.log(`    Line ${e.token.line}: token '${e.token.value}'`);
  });
  if (errors.length > 3) {
    console.log(`    ... and ${errors.length - 3} more`);
  }
});

console.log('\n========================');
console.log(`Total errors: ${parser.errors.length}`);
console.log(`Total AST nodes: ${ast.body.length}`);

// Find specific problem patterns
console.log('\n\nSpecific issues to fix:');
console.log('========================');

// Check for interface/type issues
const interfaceErrors = parser.errors.filter(e => 
  e.token.value === 'interface' || 
  e.token.value === 'type' ||
  e.token.value === 'readonly' ||
  e.token.value === '?' && e.message.includes('Expected')
);
console.log(`- Interface/Type declaration issues: ${interfaceErrors.length}`);

// Check for generic type issues  
const genericErrors = parser.errors.filter(e =>
  e.token.value === '<' || e.token.value === '>' ||
  e.message.includes('type')
);
console.log(`- Generic type issues: ${genericErrors.length}`);

// Check for semicolon issues
const semicolonErrors = parser.errors.filter(e =>
  e.token.value === ';'
);
console.log(`- Semicolon-related issues: ${semicolonErrors.length}`);