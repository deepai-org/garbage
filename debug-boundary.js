const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');
const fs = require('fs');

const code = fs.readFileSync('./src/parser.ts', 'utf8');
const lines = code.split('\n');

// Parse only up to and including a bit past parseType
const testCode = lines.slice(0, 3720).join('\n') + '\n}'; // Close the class

const lexer = new Lexer(testCode);
const tokens = lexer.tokenize();

// Find tokens around line 3712 (parseSimpleType)
console.log('=== Tokens around parseSimpleType (line 3712) ===\n');

let foundPrivate = false;
for (let i = 0; i < tokens.length; i++) {
  const t = tokens[i];
  // Look for "private parseSimpleType"
  if (t.value === 'private' && !foundPrivate) {
    // Check if next token is parseSimpleType
    if (i + 1 < tokens.length && tokens[i + 1].value === 'parseSimpleType') {
      foundPrivate = true;
      console.log('Found "private parseSimpleType" at token', i);
      console.log('\nTokens in context:');
      for (let j = Math.max(0, i - 5); j <= Math.min(tokens.length - 1, i + 10); j++) {
        if (tokens[j].type !== 'VirtualSemi' && tokens[j].type !== 'EOF') {
          const marker = j === i ? ' <-- private' : j === i + 1 ? ' <-- parseSimpleType' : '';
          console.log(`  [${j}] ${tokens[j].type}:${tokens[j].value}${marker}`);
        }
      }
      break;
    }
  }
}

if (!foundPrivate) {
  console.log('Could not find "private parseSimpleType" in tokens');
  
  // Look for any parseSimpleType
  for (let i = 0; i < tokens.length; i++) {
    if (tokens[i].value === 'parseSimpleType') {
      console.log(`Found parseSimpleType at token ${i}`);
      for (let j = Math.max(0, i - 3); j <= Math.min(tokens.length - 1, i + 3); j++) {
        if (tokens[j].type !== 'VirtualSemi') {
          console.log(`  [${j}] ${tokens[j].type}:${tokens[j].value}`);
        }
      }
      break;
    }
  }
}

// Now parse and see what happens
console.log('\n=== Parsing result ===\n');
const parser = new Parser(tokens);
const ast = parser.parse();

let memberCount = 0;
for (let node of ast.body) {
  if (node.kind === 'ExportDecl' && node.declaration?.kind === 'ClassDecl') {
    memberCount = node.declaration.members?.length || 0;
    break;
  }
}

console.log(`Members parsed: ${memberCount}`);
console.log(`Parse errors: ${parser.errors.length}`);

// Show last few errors
console.log('\nLast 5 errors:');
parser.errors.slice(-5).forEach(e => {
  console.log(`  - ${e.message}`);
});