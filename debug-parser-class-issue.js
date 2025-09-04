const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');
const fs = require('fs');

const code = fs.readFileSync('./src/parser.ts', 'utf8');
const lines = code.split('\n');

// Find where parseFuncDecl appears in the class
for (let i = 2050; i < 2060; i++) {
  console.log(`Line ${i}: ${lines[i - 1].substring(0, 80)}`);
}

// Now parse and check what happens
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

if (classDecl) {
  const members = classDecl.members || [];
  console.log(`\nClass has ${members.length} members`);
  
  // Show members around 45
  console.log('\nMembers 43-48:');
  for (let i = 42; i < Math.min(48, members.length); i++) {
    const m = members[i];
    const name = m.name?.name || m.kind || 'Unknown';
    console.log(`  ${i}: ${name}`);
  }
  
  // Check what line member 45 is at
  if (members[44]) {
    const m = members[44];
    console.log(`\nMember 44 (${m.name?.name || m.kind}):`);
    // Try to find this in the source
    if (m.name?.name === 'parseFuncDecl') {
      console.log('  This is the parseFuncDecl method');
    }
  }
}