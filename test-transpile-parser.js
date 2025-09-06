const fs = require('fs');
const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');
const { Transpiler } = require('./dist/transpiler');

console.log('Testing Transpiler on parser.ts');
console.log('='.repeat(50));

// Read the parser source
const source = fs.readFileSync('./src/parser.ts', 'utf-8');
console.log(`Source size: ${(source.length / 1024).toFixed(1)} KB`);

// Tokenize and parse
console.log('\n1. Tokenizing...');
const lexer = new Lexer(source);
const tokens = lexer.tokenize();
console.log(`   Tokens: ${tokens.length}`);

console.log('\n2. Parsing...');
const parser = new Parser(tokens);
const ast = parser.parse();
console.log(`   Parse errors: ${parser.errors.length}`);

if (parser.errors.length > 0) {
  console.log('\n❌ Cannot transpile - parsing failed!');
  parser.errors.slice(0, 5).forEach(err => {
    console.log(`   - ${err.message} at "${err.token?.value}" (line ${err.token?.line})`);
  });
  process.exit(1);
}

console.log('\n3. Transpiling to JavaScript...');
const transpiler = new Transpiler();

try {
  const output = transpiler.transpile(ast);
  console.log(`   Output size: ${(output.length / 1024).toFixed(1)} KB`);
  
  // Write to file
  const outputPath = './transpiled-parser.js';
  fs.writeFileSync(outputPath, output);
  console.log(`   Written to: ${outputPath}`);
  
  // Try to validate the JavaScript syntax
  console.log('\n4. Validating JavaScript syntax...');
  try {
    new Function(output); // This will throw if syntax is invalid
    console.log('   ✅ Valid JavaScript syntax!');
  } catch (syntaxError) {
    console.log('   ❌ Invalid JavaScript syntax:');
    console.log(`   ${syntaxError.message}`);
    
    // Find the error location
    const match = syntaxError.message.match(/at position (\d+)/);
    if (match) {
      const pos = parseInt(match[1]);
      const lines = output.split('\n');
      let currentPos = 0;
      for (let i = 0; i < lines.length; i++) {
        if (currentPos + lines[i].length >= pos) {
          console.log(`   Near line ${i + 1}: ${lines[i].trim()}`);
          break;
        }
        currentPos += lines[i].length + 1; // +1 for newline
      }
    }
  }
  
  // Show first few lines of output
  console.log('\n5. First 20 lines of transpiled code:');
  console.log('-'.repeat(40));
  const lines = output.split('\n').slice(0, 20);
  lines.forEach((line, i) => {
    console.log(`${(i + 1).toString().padStart(3)}: ${line}`);
  });
  
} catch (error) {
  console.log(`\n❌ Transpilation failed!`);
  console.log(`   Error: ${error.message}`);
  console.log(`   Stack: ${error.stack}`);
}