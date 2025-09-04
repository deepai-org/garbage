const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

// Test various type assertion patterns
const testCases = [
  'const value = someValue as string',
  'const num = <number>someValue',
  'const x = (value as any) as string',
  'const y = value as string | number',
  'const z = value as Type[]',
  'return result as T',
  'throw error as CustomError',
  'if (x as boolean) { }',
];

for (const code of testCases) {
  console.log(`\nTesting: ${code}`);
  const lexer = new Lexer(code);
  const tokens = lexer.tokenize();
  console.log('Tokens:', tokens.map(t => `${t.type}:${t.value}`).join(' '));
  
  const parser = new Parser(tokens);
  const ast = parser.parse();
  
  if (parser.errors.length > 0) {
    console.log('Errors:', parser.errors.map(e => e.message).join(', '));
  } else {
    console.log('Success!');
  }
}