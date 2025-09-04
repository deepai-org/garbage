const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');
const fs = require('fs');

// Get the actual problematic lines from parser.ts
const code = fs.readFileSync('./src/parser.ts', 'utf8');
const lines = code.split('\n');

// Extract around line 2038 where parseFuncDecl is
const testCode = `
class Parser {
  ${lines.slice(2036, 2070).join('\n  ')}
}
`;

console.log('Testing actual parser.ts code around parseFuncDecl:');
console.log('Code being tested:');
console.log(testCode.split('\n').slice(2, 7).join('\n'));
console.log('...\n');

const lexer = new Lexer(testCode);
const tokens = lexer.tokenize();
const parser = new Parser(tokens);
const ast = parser.parse();

const classNode = ast.body[0];
if (classNode?.kind === 'ClassDecl') {
  console.log(`Class has ${classNode.members?.length || 0} members:`);
  classNode.members?.slice(0, 10).forEach((m, i) => {
    const name = m.name?.name || m.kind || 'Unknown';
    console.log(`  ${i}: ${name}`);
  });
}

console.log(`\nParse errors: ${parser.errors.length}`);
if (parser.errors.length > 0) {
  console.log('First 5 errors:');
  parser.errors.slice(0, 5).forEach(e => {
    console.log(`  ${e.message} at token '${e.token.value}'`);
  });
}