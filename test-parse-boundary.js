const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');
const fs = require('fs');

const code = fs.readFileSync('./src/parser.ts', 'utf8');
const lines = code.split('\n');

// Get code from parseType to just after parseSimpleType starts
// Lines 3584 to 3710
const testCode = 'export class Parser {\n' + 
                 lines.slice(3583, 3710).join('\n') + 
                 '\n}';

console.log('Testing parseType (ends at line 3700) and parseSimpleType (starts at 3702)');
console.log('Code snippet has', testCode.split('\n').length, 'lines\n');

const lexer = new Lexer(testCode);
const tokens = lexer.tokenize();
const parser = new Parser(tokens);

try {
  const ast = parser.parse();
  
  let classNode = ast.body[0];
  if (classNode?.kind === 'ExportDecl') {
    classNode = classNode.declaration;
  }
  
  console.log(`Members parsed: ${classNode.members?.length}`);
  if (classNode.members) {
    classNode.members.forEach(m => {
      if (m.kind === 'Method') {
        console.log(`  - ${m.name?.name}`);
      }
    });
  }
  
  console.log(`\nParse errors: ${parser.errors.length}`);
  
  // Show first few errors
  parser.errors.slice(0, 5).forEach(e => {
    const tokenInfo = e.token ? ` at token '${e.token.value}'` : '';
    console.log(`  - ${e.message}${tokenInfo}`);
  });
  
  // Check where parsing stops
  if (classNode.members && classNode.members.length > 0) {
    const lastMember = classNode.members[classNode.members.length - 1];
    console.log(`\nLast successfully parsed member: ${lastMember.name?.name || 'unknown'}`);
  }
} catch (e) {
  console.log(`Parse failed: ${e.message}`);
}