const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

// Test various colon usage patterns
const tests = [
  {
    name: "Object literal with types",
    code: `{
      kind: "Test",
      name: identifier,
      value: 42
    }`
  },
  {
    name: "Object shorthand and spread",
    code: `{
      kind: "Node",
      name,
      ...rest,
      end: true
    }`
  },
  {
    name: "Conditional with object",
    code: `
      const result = test ? {
        kind: "Success",
        value: 1
      } : {
        kind: "Failure",
        error: msg
      };
    `
  },
  {
    name: "Return statement with object",
    code: `
      function test() {
        return {
          kind: "Result",
          data: value
        };
      }
    `
  },
  {
    name: "Nested objects",
    code: `{
      outer: {
        inner: {
          kind: "Nested"
        }
      }
    }`
  },
  {
    name: "Type annotation in variable",
    code: `
      const x: string = "test";
      let y: number = 42;
      var z: boolean = true;
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
    const errors = parser.errors.filter(e => 
      e.message.includes('Unexpected token') && e.token?.value === ':');
    
    console.log(`Total errors: ${parser.errors.length}`);
    console.log(`Colon-related errors: ${errors.length}`);
    
    if (errors.length > 0) {
      console.log('First colon error:');
      const e = errors[0];
      if (e.token) {
        const idx = tokens.indexOf(e.token);
        console.log(`  Error: ${e.message}`);
        console.log('  Context:');
        for (let i = Math.max(0, idx - 2); i <= Math.min(tokens.length - 1, idx + 2); i++) {
          const t = tokens[i];
          if (t.type !== 'VirtualSemi' && t.type !== 'EOF') {
            const marker = i === idx ? ' <-- ERROR' : '';
            console.log(`    ${t.type}:${t.value}${marker}`);
          }
        }
      }
    }
  } catch (e) {
    console.log(`Parse failed: ${e.message}`);
  }
});