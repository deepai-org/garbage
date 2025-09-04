const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');
const fs = require('fs');

// Get just the lines around the failing method
const code = fs.readFileSync('./src/parser.ts', 'utf8');
const lines = code.split('\n');

// Create a minimal class with the failing method and context
const testCode = `
export class Parser {
  ${lines.slice(2040, 2055).join('\n  ')}
  ${lines.slice(2055, 2090).join('\n  ')}
}
`;

console.log('Testing exact failing context:');
console.log('First few lines:');
console.log(testCode.split('\n').slice(2, 7).join('\n'));

const lexer = new Lexer(testCode);
const tokens = lexer.tokenize();

// Find parseFuncDecl
let funcDeclIndex = -1;
tokens.forEach((t, i) => {
  if (t.value === 'parseFuncDecl' && tokens[i+1]?.value === '(') {
    funcDeclIndex = i;
  }
});

if (funcDeclIndex > 0) {
  console.log('\nTokens around parseFuncDecl:');
  for (let i = funcDeclIndex - 5; i < funcDeclIndex + 25; i++) {
    const t = tokens[i];
    if (t && t.type !== 'VirtualSemi' && t.type !== 'EOF') {
      console.log(`  [${i}] ${t.type}:${t.value}`);
    }
  }
}

const parser = new Parser(tokens);
const ast = parser.parse();

const exportNode = ast.body[0];
if (exportNode?.kind === 'ExportDecl' && exportNode.declaration?.kind === 'ClassDecl') {
  const classDecl = exportNode.declaration;
  console.log(`\nClass has ${classDecl.members?.length || 0} members`);
  
  classDecl.members?.forEach((m, i) => {
    const name = m.name?.name || m.kind || 'Unknown';
    console.log(`  ${i}: ${name} (${m.kind})`);
  });
}

console.log(`\nParse errors: ${parser.errors.length}`);
if (parser.errors.length > 0) {
  console.log('First 10 errors:');
  parser.errors.slice(0, 10).forEach(e => {
    console.log(`  ${e.message}`);
  });
}