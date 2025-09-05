const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');
const fs = require('fs');

const code = fs.readFileSync('./src/parser.ts', 'utf8');
const lines = code.split('\n');

// Extract just parseType method and the beginning of parseSimpleType
// parseType: lines 3596-3700
// parseSimpleType starts at 3702
const methodCode = lines.slice(3595, 3720).join('\n');

console.log('=== Testing parseType + parseSimpleType ===\n');

// Wrap in a minimal class
const testCode = `
export class Test {
${methodCode}
}`;

const lexer = new Lexer(testCode);
const tokens = lexer.tokenize();
const parser = new Parser(tokens);

try {
  const ast = parser.parse();
  
  let classNode = ast.body[0];
  if (classNode?.kind === 'ExportDecl') {
    classNode = classNode.declaration;
  }
  
  console.log(`Members parsed: ${classNode.members?.length || 0}`);
  
  // Show which members were parsed
  if (classNode.members) {
    classNode.members.forEach((m, idx) => {
      if (m.kind === 'Method') {
        console.log(`  ${idx}: ${m.name?.name}`);
      }
    });
  }
  
  console.log(`\nParse errors: ${parser.errors.length}`);
  
  // Show first few errors
  if (parser.errors.length > 0) {
    console.log('\nFirst 5 errors:');
    parser.errors.slice(0, 5).forEach(e => {
      console.log(`  - ${e.message} at token '${e.token?.value}'`);
    });
  }
  
  // Find the exact line causing the issue
  const failureErrors = parser.errors.filter(e => 
    e.message === "Unexpected token in expression" || 
    e.message === "Expected identifier");
    
  if (failureErrors.length > 0) {
    const firstFailure = failureErrors[0];
    console.log('\n=== First failure point ===');
    console.log(`Error: ${firstFailure.message}`);
    console.log(`Token: '${firstFailure.token?.value}'`);
    
    // Find the line containing this token
    const tokenIdx = tokens.indexOf(firstFailure.token);
    if (tokenIdx > 0) {
      console.log('\nToken context:');
      for (let i = Math.max(0, tokenIdx - 3); i <= Math.min(tokens.length - 1, tokenIdx + 3); i++) {
        const t = tokens[i];
        if (t.type !== 'VirtualSemi' && t.type !== 'EOF') {
          const marker = i === tokenIdx ? ' <-- ERROR HERE' : '';
          console.log(`  [${i}] ${t.type}:${t.value}${marker}`);
        }
      }
    }
  }
} catch (e) {
  console.log(`Parse failed: ${e.message}`);
}