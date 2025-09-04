const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');
const fs = require('fs');

// Extract just the parse() method from parser.ts
const code = fs.readFileSync('./src/parser.ts', 'utf-8');
const lines = code.split('\n');

// Find the parse() method (lines 42-100 approx)
const methodLines = lines.slice(41, 105); // parse() method approximately
const methodCode = `
class TestParser {
  private tokens = [];
  private current = 0;
  private errors = [];
  
${methodLines.join('\n')}
}`;

console.log('Testing actual parse() method parsing...\n');

const lexer = new Lexer(methodCode);
const tokens = lexer.tokenize();
const parser = new Parser(tokens);
const ast = parser.parse();

console.log('Parse errors:', parser.errors.length);
if (parser.errors.length > 0) {
  console.log('\nFirst 5 errors:');
  parser.errors.slice(0, 5).forEach(e => {
    console.log(`  Line ${e.token.line}: ${e.message} at token '${e.token.value}'`);
  });
}

// Check the class
if (ast.body[0]?.kind === 'ClassDecl') {
  const classDecl = ast.body[0];
  console.log(`\nClass has ${classDecl.members?.length || 0} members`);
  const methods = classDecl.members?.filter(m => m.kind === 'Method') || [];
  console.log(`Methods: ${methods.map(m => m.name?.name).join(', ')}`);
}