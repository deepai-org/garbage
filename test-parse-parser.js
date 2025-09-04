const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');
const fs = require('fs');

// Read parser.ts file
const parserSource = fs.readFileSync('src/parser.ts', 'utf-8');

console.log('Parser.ts file size:', parserSource.length, 'bytes');
console.log('Lines:', parserSource.split('\n').length);

// Try to lex and parse it
const lexer = new Lexer(parserSource);
const tokens = lexer.tokenize();

console.log('\nTokens generated:', tokens.length);

const parser = new Parser(tokens);
const ast = parser.parse();

console.log('\nAST nodes in body:', ast.body.length);
console.log('Parse errors:', parser.getErrors().length);

if (parser.getErrors().length > 0) {
  console.log('\nFirst 5 errors:');
  parser.getErrors().slice(0, 5).forEach(err => {
    console.log(' -', err.message);
  });
} else {
  console.log('Successfully parsed!');
}

// Try to transpile
const { Transpiler } = require('./dist/transpiler');
const transpiler = new Transpiler();

if (parser.getErrors().length === 0) {
  const output = transpiler.transpile(ast);
  console.log('\nTranspiled output size:', output.length, 'bytes');
  
  // Save transpiled output
  fs.writeFileSync('transpiled-parser.ts', output);
  console.log('Saved to transpiled-parser.ts');
} else {
  console.log('\nSkipping transpilation due to parse errors');
}