const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');
const fs = require('fs');

// Get the actual parseSimpleType method from the parser source
const code = fs.readFileSync('./src/parser.ts', 'utf8');
const lines = code.split('\n');

// Extract parseSimpleType method (lines 3679-3915)
const methodCode = lines.slice(3678, 3915).join('\n');

// Wrap it in a class to test parsing
const testCode = `
class TestParser {
${methodCode}
  
  // Next method should be parsed
  private isType(): boolean {
    return true;
  }
}
`;

console.log('=== Testing parseSimpleType method parsing ===\n');
console.log('Method has', methodCode.split('\n').length, 'lines');

const lexer = new Lexer(testCode);
const tokens = lexer.tokenize();
const parser = new Parser(tokens);

try {
  const ast = parser.parse();
  
  // Find the class
  let classNode = ast.body[0];
  if (classNode?.kind === 'ClassDecl') {
    console.log(`\nClass has ${classNode.members?.length || 0} members`);
    classNode.members?.forEach((m, idx) => {
      if (m.kind === 'Method') {
        const name = m.name?.name || 'unnamed';
        console.log(`  Member ${idx}: ${name}`);
      }
    });
  }
  
  console.log(`\nTotal parse errors: ${parser.errors.length}`);
  
  // Show first 5 errors
  parser.errors.slice(0, 5).forEach(e => {
    const tokenInfo = e.token ? ` (token: ${e.token.type}:${e.token.value})` : '';
    console.log(`  - ${e.message}${tokenInfo}`);
  });
} catch (e) {
  console.log(`\nParse failed: ${e.message}`);
}