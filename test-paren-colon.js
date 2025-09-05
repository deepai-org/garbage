const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');
const fs = require('fs');

// Find all instances of ") :" pattern in the source
const parserSource = fs.readFileSync('./src/parser.ts', 'utf8');
const lines = parserSource.split('\n');

console.log('=== Looking for ") :" patterns in parser.ts ===\n');

const parenColonLines = [];
for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  if (line.includes('): ')) {
    parenColonLines.push({
      lineNum: i + 1,
      line: line.trim()
    });
  }
}

console.log(`Found ${parenColonLines.length} lines with "): " pattern:`);
parenColonLines.slice(0, 10).forEach(item => {
  console.log(`  Line ${item.lineNum}: ${item.line}`);
});

// Test each of these patterns individually
console.log('\n=== Testing first few patterns ===\n');

for (let i = 0; i < Math.min(3, parenColonLines.length); i++) {
  const item = parenColonLines[i];
  console.log(`Testing line ${item.lineNum}: ${item.line}`);
  
  try {
    const lexer = new Lexer(item.line);
    const tokens = lexer.tokenize();
    const parser = new Parser(tokens);
    const ast = parser.parse();
    
    console.log('  ✅ Success');
    
  } catch (error) {
    console.log(`  ❌ Failed: ${error.message}`);
    
    // Show tokens for debugging
    const lexer = new Lexer(item.line);
    const tokens = lexer.tokenize();
    const parser = new Parser(tokens);
    
    try {
      parser.parse();
    } catch (e) {
      console.log('  Tokens:', tokens.map(t => `${t.type}:${t.value}`).join(' '));
      console.log('  Errors:', parser.errors.map(e => e.message).join(', '));
    }
  }
  console.log();
}