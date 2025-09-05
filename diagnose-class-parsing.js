const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');
const fs = require('fs');

// Read just the beginning of the parser file up to a few methods
const parserSource = fs.readFileSync('./src/parser.ts', 'utf8');
const lines = parserSource.split('\n');

// Find the Parser class and grab the first few methods to test smaller chunks
let classStart = -1;
let classEnd = -1;

for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('export class Parser')) {
    classStart = i;
  }
  // Look for the end of the first method or two
  if (classStart >= 0 && i > classStart + 50 && lines[i].trim() === '}' && 
      lines[i-1].trim() !== '' && !lines[i-1].includes('//')) {
    classEnd = i + 1;
    break;
  }
}

if (classStart >= 0 && classEnd >= 0) {
  // Extract the class with first method
  const testCode = lines.slice(classStart, Math.min(classEnd + 20, classStart + 100)).join('\n');
  
  console.log('=== Testing Parser class structure ===');
  console.log(`Lines ${classStart + 1} to ${Math.min(classEnd + 20, classStart + 100)}`);
  console.log('Code:');
  console.log(testCode.substring(0, 1000) + '...');
  
  console.log('\n=== Parsing test ===');
  
  try {
    const lexer = new Lexer(testCode);
    const tokens = lexer.tokenize();
    const parser = new Parser(tokens);
    const ast = parser.parse();
    
    console.log('✅ Parsing succeeded!');
    console.log('AST body length:', ast.body.length);
    
    if (parser.errors.length > 0) {
      console.log(`\n⚠️  Found ${parser.errors.length} parser errors:`);
      parser.errors.slice(0, 5).forEach((err, i) => {
        console.log(`  ${i + 1}. ${err.message} at ${err.token?.type}:${err.token?.value}`);
      });
    }
    
  } catch (error) {
    console.log('❌ Parsing failed:', error.message);
    
    // Try to get errors anyway
    const lexer = new Lexer(testCode);
    const tokens = lexer.tokenize();
    const parser = new Parser(tokens);
    
    try {
      parser.parse();
    } catch (e) {
      if (parser.errors.length > 0) {
        console.log(`Found ${parser.errors.length} errors:`);
        parser.errors.slice(0, 3).forEach((err, i) => {
          console.log(`  ${i + 1}. ${err.message} at ${err.token?.type}:${err.token?.value}`);
        });
      }
    }
  }
} else {
  console.log('Could not find Parser class boundaries');
}