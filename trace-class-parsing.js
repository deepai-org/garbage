const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');
const fs = require('fs');

const code = fs.readFileSync('./src/parser.ts', 'utf8');
const lines = code.split('\n');

// Extract just lines around parseFuncDecl method
const startLine = 2050;
const endLine = 2100;
const classCode = `
export class Parser {
  private tokens: Token[] = [];
  
  ${lines.slice(startLine, endLine).join('\n  ')}
}
`;

console.log('Testing class with parseFuncDecl method:');
console.log('Lines included: ' + startLine + ' to ' + endLine);
console.log('\nFirst few lines of method:');
for (let i = 2054; i < 2060; i++) {
  console.log(`  ${i}: ${lines[i-1].substring(0, 70)}`);
}

const lexer = new Lexer(classCode);
const tokens = lexer.tokenize();

// Show tokens around where parseFuncDecl starts
console.log('\nTokens around parseFuncDecl:');
let foundParseFuncDecl = false;
let tokenCount = 0;
tokens.forEach((t, i) => {
  if (t.value === 'parseFuncDecl') {
    foundParseFuncDecl = true;
    tokenCount = 0;
  }
  if (foundParseFuncDecl && tokenCount < 20) {
    if (t.type !== 'VirtualSemi' && t.type !== 'EOF') {
      console.log(`  [${i}] ${t.type}:${t.value}`);
    }
    tokenCount++;
  }
});

const parser = new Parser(tokens);
const ast = parser.parse();

// Check class
const exportNode = ast.body[0];
if (exportNode?.kind === 'ExportDecl' && exportNode.declaration?.kind === 'ClassDecl') {
  const classDecl = exportNode.declaration;
  console.log(`\nClass has ${classDecl.members?.length || 0} members`);
  
  // Show last few members
  const members = classDecl.members || [];
  console.log('Last few members:');
  for (let i = Math.max(0, members.length - 5); i < members.length; i++) {
    const m = members[i];
    console.log(`  ${i}: ${m.name?.name || m.kind || 'Unknown'}`);
  }
}

console.log(`\nParse errors: ${parser.errors.length}`);
if (parser.errors.length > 0) {
  console.log('First 5 errors:');
  parser.errors.slice(0, 5).forEach(e => {
    console.log(`  ${e.message} at token '${e.token.value}'`);
  });
}