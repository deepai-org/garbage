const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');
const fs = require('fs');

const code = fs.readFileSync('./src/parser.ts', 'utf8');
const lines = code.split('\n');
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
  console.log(`Found ${classDecl.members.length} members\n`);
  
  // Show the last few members
  const lastFew = classDecl.members.slice(-5);
  console.log('Last 5 members:');
  lastFew.forEach((member, i) => {
    const idx = classDecl.members.length - 5 + i;
    const name = member.name?.name || member.kind || 'Unknown';
    console.log(`  Member ${idx}: ${name}`);
  });
  
  // Check for errors around where parsing stopped
  const relevantErrors = parser.errors.filter(e => {
    const line = e.token?.line || 0;
    return line >= 300 && line <= 320;
  });
  
  console.log(`\nErrors around line 305-320: ${relevantErrors.length}`);
  relevantErrors.forEach(e => {
    console.log(`  Line ${e.token.line}: ${e.message} at token "${e.token.value}"`);
    const line = lines[e.token.line - 1];
    console.log(`    Code: ${line.trim().substring(0, 50)}`);
  });
}