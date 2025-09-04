const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');
const fs = require('fs');

const code = fs.readFileSync('./src/parser.ts', 'utf8');
const lexer = new Lexer(code);
const tokens = lexer.tokenize();
const parser = new Parser(tokens);
const ast = parser.parse();

console.log(`Total parse errors: ${parser.errors.length}`);

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

if (classDecl) {
  const members = classDecl.members || [];
  console.log(`Parser class has ${members.length} members (should be hundreds)`);
  
  // Show last few members  
  console.log('\nLast 5 members:');
  for (let i = Math.max(0, members.length - 5); i < members.length; i++) {
    const m = members[i];
    const name = m.name?.name || m.kind || 'Unknown';
    console.log(`  ${i}: ${name} (${m.kind})`);
  }
}

// Group errors by type
const errorTypes = {};
parser.errors.forEach(e => {
  const key = e.message.split(' at ')[0];
  errorTypes[key] = (errorTypes[key] || 0) + 1;
});

console.log('\nError types:');
Object.entries(errorTypes)
  .sort((a, b) => b[1] - a[1])
  .slice(0, 10)
  .forEach(([msg, count]) => {
    console.log(`  ${count}x: ${msg}`);
  });