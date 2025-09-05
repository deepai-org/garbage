const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

// Test various switch/case patterns
const tests = [
  {
    name: "Simple switch",
    code: `
      switch (type) {
        case "string":
          return "text";
        case "number":
          return "numeric";
        default:
          return "unknown";
      }
    `
  },
  {
    name: "Switch with string literals",
    code: `
      switch (node.kind) {
        case "ChanType":
          const prefix = "chan<";
          break;
        case "NullableType":
          return \`\${inner}?\`;
      }
    `
  },
  {
    name: "Nested in class method",
    code: `
      class Test {
        method(x) {
          switch (x) {
            case "a": return 1;
            case "b": return 2;
          }
        }
      }
    `
  }
];

tests.forEach(test => {
  console.log(`\n=== ${test.name} ===`);
  
  const lexer = new Lexer(test.code);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens);
  
  try {
    const ast = parser.parse();
    console.log(`✓ Parsed successfully`);
    console.log(`  Errors: ${parser.errors.length}`);
    
    if (parser.errors.length > 0) {
      console.log('  Error details:');
      parser.errors.slice(0, 3).forEach(e => {
        console.log(`    - ${e.message}`);
      });
    }
  } catch (e) {
    console.log(`✗ Parse failed: ${e.message}`);
  }
});

// Test the exact failing pattern
console.log('\n=== Exact failing pattern ===');
const failingCode = `
  case "ChanType":
    const prefix = "chan";
`;

const lexer = new Lexer(failingCode);
const tokens = lexer.tokenize();

console.log('Tokens:');
tokens.forEach((t, i) => {
  if (t.type !== 'VirtualSemi' && t.type !== 'EOF') {
    console.log(`  [${i}] ${t.type}:${t.value}`);
  }
});

const parser = new Parser(tokens);
try {
  const ast = parser.parse();
  console.log(`\nParsed with ${parser.errors.length} errors`);
} catch (e) {
  console.log(`\nParse failed: ${e.message}`);
}