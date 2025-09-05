const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');
const fs = require('fs');

const code = fs.readFileSync('./src/parser.ts', 'utf8');
const lexer = new Lexer(code);
const tokens = lexer.tokenize();
const parser = new Parser(tokens);
const ast = parser.parse();

// Find the Parser class
let classDecl = null;
for (let node of ast.body) {
  if (node.kind === 'ExportDecl' && node.declaration?.kind === 'ClassDecl') {
    if (node.declaration.name?.name === 'Parser') {
      classDecl = node.declaration;
      break;
    }
  }
}

if (classDecl && classDecl.members) {
  // Show members around the cutoff
  console.log('Members 70-74:');
  for (let i = 69; i < Math.min(74, classDecl.members.length); i++) {
    const m = classDecl.members[i];
    const name = m.name?.name || m.kind || 'Unknown';
    console.log(`  Member ${i + 1}: ${name} (${m.kind})`);
  }
  
  // Get the actual line position of member 73
  if (classDecl.members[72]) {
    const member73 = classDecl.members[72];
    console.log('\n=== Member 73 details ===');
    console.log('Name:', member73.name?.name);
    console.log('Kind:', member73.kind);
    console.log('Span:', member73.span);
  }
}

// Show parse errors
console.log(`\nTotal parse errors: ${parser.errors.length}`);

// Group errors by type
const errorGroups = {};
parser.errors.forEach(e => {
  const key = e.message;
  errorGroups[key] = (errorGroups[key] || 0) + 1;
});

console.log('\nTop error patterns:');
Object.entries(errorGroups)
  .sort((a, b) => b[1] - a[1])
  .slice(0, 5)
  .forEach(([msg, count]) => {
    console.log(`  ${count}x: ${msg}`);
  });