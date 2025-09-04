const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

// Test with increasing complexity
const testCases = [
  {
    name: 'Basic async function',
    code: `async function test() { return 42 }`
  },
  {
    name: 'With try/catch',
    code: `async function test() {
      try {
        return 42
      } catch (e) {
        throw e
      }
    }`
  },
  {
    name: 'With bash while',
    code: `async function test() {
      while [ $x -lt 3 ]; do
        echo "test"
      done
    }`
  },
  {
    name: 'With nested try in bash while',
    code: `async function test() {
      while [ $x -lt 3 ]; do
        try:
          pass
        except:
          pass
      done
    }`
  },
  {
    name: 'Full structure',
    code: `async function test() {
      try {
        with conn:
          defer close()
          while [ $x -lt 3 ]; do
            try:
              data := await fetch()
            except:
              pass
            finally:
              log("done")
          done
      } catch (e) {
        throw e
      } finally {
        return result
      }
    }`
  }
];

for (const test of testCases) {
  console.log(`\nTesting: ${test.name}`);
  
  const lexer = new Lexer(test.code);
  const tokens = lexer.tokenize();
  
  let parseCount = 0;
  const parser = new Parser(tokens);
  
  const originalMethod = parser.parseTopLevel;
  parser.parseTopLevel = function() {
    parseCount++;
    if (parseCount > 100) {
      console.log(`  ❌ Too many calls: ${parseCount} at position ${this.current}`);
      return null;
    }
    return originalMethod.call(this);
  };
  
  const timeout = setTimeout(() => {
    console.log(`  ❌ TIMEOUT after ${parseCount} calls`);
    process.exit(1);
  }, 1000);
  
  try {
    const ast = parser.parse();
    clearTimeout(timeout);
    console.log(`  ✅ Success! AST nodes: ${ast.body.length}, calls: ${parseCount}`);
  } catch (e) {
    clearTimeout(timeout);
    console.log(`  ❌ Error: ${e.message}`);
  }
}