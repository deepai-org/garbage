const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');
const fs = require('fs');

// Extract just the parseTemplateLiteral method and a bit after
const code = fs.readFileSync('./src/parser.ts', 'utf8');
const lines = code.split('\\n');

// Get parseTemplateLiteral method (starts at line 4740)
// And the next method to see where parsing fails
const testCode = `
export class TestParser {
${lines.slice(4739, 4830).join('\\n')}
}
`;

console.log('=== Testing parseTemplateLiteral method parsing ===\\n');

const lexer = new Lexer(testCode);
const tokens = lexer.tokenize();
const parser = new Parser(tokens);
const ast = parser.parse();

let classNode = ast.body[0];
if (classNode?.kind === 'ExportDecl') {
  classNode = classNode.declaration;
}

console.log(`Members parsed: ${classNode.members?.length || 0}`);

// Show which members were parsed
if (classNode.members) {
  classNode.members.forEach((m, idx) => {
    const name = m.name?.name || m.kind || 'Unknown';
    console.log(`  ${idx}: ${name} (${m.kind})`);
  });
}

console.log(`\\nParse errors: ${parser.errors.length}`);

// Show first few errors
if (parser.errors.length > 0) {
  console.log('\\nFirst 5 errors:');
  parser.errors.slice(0, 5).forEach(e => {
    console.log(`  - ${e.message} at token '${e.token?.value}'`);
  });
}