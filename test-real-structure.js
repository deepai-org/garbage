const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');
const fs = require('fs');

// Extract a section of the real parser.ts that includes a failing method
const parserSource = fs.readFileSync('./src/parser.ts', 'utf8');
const lines = parserSource.split('\n');

// Find the parseSimpleType method and extract a chunk around it
let startLine = -1;
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('parseSimpleType()')) {
    startLine = i - 5; // Include some context before
    break;
  }
}

if (startLine >= 0) {
  // Extract a section that includes the class context and the failing method
  const contextLines = lines.slice(Math.max(0, startLine), startLine + 20);
  const testCode = contextLines.join('\n');
  
  console.log('=== Testing real parser structure ===');
  console.log('Extracted lines:', startLine, 'to', startLine + 20);
  console.log('Code snippet:');
  console.log(testCode);
  console.log('\n=== Parsing test ===');
  
  try {
    const lexer = new Lexer(testCode);
    const tokens = lexer.tokenize();
    const parser = new Parser(tokens);
    const ast = parser.parse();
    
    console.log('✅ Parsing succeeded!');
    
    if (parser.errors.length > 0) {
      console.log('\n⚠️  Parser errors:');
      parser.errors.slice(0, 3).forEach((err, i) => {
        console.log(`  ${i + 1}. ${err.message} at ${err.token?.type}:${err.token?.value}`);
      });
    }
    
  } catch (error) {
    console.log('❌ Parsing failed:', error.message);
  }
} else {
  console.log('Could not find parseSimpleType method');
}