const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');
const fs = require('fs');

// Get the actual problematic code from line 1650
const code = fs.readFileSync('./src/parser.ts', 'utf8');
const lines = code.split('\n');

// Extract the parsePostfix method which contains the problematic code
const testCode = `
class Parser {
  private parsePostfix(): AST.Expr {
    ${lines.slice(1648, 1660).join('\n    ')}
  }
}
`;

console.log('Testing actual problematic code:');
console.log(testCode);

const lexer = new Lexer(testCode);
const tokens = lexer.tokenize();
const parser = new Parser(tokens);
const ast = parser.parse();

const classNode = ast.body[0];
if (classNode?.kind === 'ClassDecl') {
  console.log(`\nClass has ${classNode.members?.length || 0} members`);
}

console.log(`\nParse errors: ${parser.errors.length}`);
if (parser.errors.length > 0) {
  parser.errors.forEach(e => {
    console.log(`  ${e.message}`);
  });
}