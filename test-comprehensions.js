const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

const testCases = [
  { 
    name: 'List comprehension',
    code: 'result := [x * 2 for x in range(10)]'
  },
  { 
    name: 'Dict comprehension',
    code: 'result := {k: v for k, v in items}'
  },
  { 
    name: 'Set comprehension',
    code: 'result := {x for x in items if x > 0}'
  },
  { 
    name: 'Generator expression',
    code: 'result := (x * 2 for x in range(10))'
  },
  { 
    name: 'Nested comprehension',
    code: 'result := [[x*y for x in row] for y in matrix]'
  }
];

for (const test of testCases) {
  console.log(`\nTesting: ${test.name}`);
  console.log(`Code: ${test.code}`);
  
  try {
    const lexer = new Lexer(test.code);
    const tokens = lexer.tokenize();
    
    // Show tokens for first test
    if (test.name === 'List comprehension') {
      console.log('Tokens:');
      tokens.forEach(t => {
        if (t.type !== 'Whitespace') {
          console.log(`  ${t.type}: "${t.value}"`);
        }
      });
    }
    
    const parser = new Parser(tokens);
    const ast = parser.parse();
    console.log(`✅ Success: ${ast.body.length} nodes`);
  } catch (e) {
    console.log(`❌ Error: ${e.message}`);
  }
}