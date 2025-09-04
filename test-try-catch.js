const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

// Test try-catch parsing
const testCases = [
  `try { }`,
  `try { } catch { }`,
  `try { } catch (e) { }`,
  `try { } catch (error: Error) { }`,
  `try { 
    doSomething();
  } catch (error) {
    console.log(error);
  }`,
  `try {
    const x = 1;
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
  }`
];

for (const code of testCases) {
  console.log(`\nTesting: ${code.split('\n')[0]}${code.includes('\n') ? '...' : ''}`);
  const lexer = new Lexer(code);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens);
  const ast = parser.parse();
  
  if (parser.errors.length > 0) {
    console.log('  Errors:', parser.errors.map(e => e.message).join(', '));
  } else {
    console.log('  Success!');
  }
}