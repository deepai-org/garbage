const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');
const fs = require('fs');

const code = fs.readFileSync('./src/parser.ts', 'utf8');
const lexer = new Lexer(code);
const tokens = lexer.tokenize();
const parser = new Parser(tokens);
const ast = parser.parse();

// Find "Expected 'in' after case expression" errors
const caseErrors = parser.errors.filter(e => 
  e.message.includes("Expected 'in' after case expression"));

if (caseErrors.length > 0) {
  console.log(`Found ${caseErrors.length} "Expected 'in' after case expression" errors`);
  console.log('\nFirst few examples:');
  
  caseErrors.slice(0, 3).forEach((e, i) => {
    console.log(`\nError ${i + 1}: ${e.message}`);
    if (e.token) {
      // Find token in list
      const errorTokenIndex = tokens.findIndex(t => t === e.token);
      if (errorTokenIndex >= 0) {
        console.log('  Context:');
        for (let j = Math.max(0, errorTokenIndex - 5); j < Math.min(tokens.length, errorTokenIndex + 3); j++) {
          const t = tokens[j];
          if (t.type !== 'VirtualSemi' && t.type !== 'EOF' && t.type !== 'Comment') {
            const marker = j === errorTokenIndex ? ' <-- ERROR HERE' : '';
            console.log(`    [${j}] ${t.type}:${t.value}${marker}`);
          }
        }
      }
    }
  });
}