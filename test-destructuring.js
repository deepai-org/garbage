const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

function testDestructuring(code, description) {
  console.log(`\n${description}:`);
  console.log(`Code: ${code}`);
  
  try {
    const lexer = new Lexer(code);
    const tokens = lexer.tokenize();
    const parser = new Parser(tokens);
    const ast = parser.parse();
    
    const stmt = ast.body[0];
    if (stmt.kind === 'FuncDecl') {
      console.log('Function found:', stmt.name.name);
      console.log('Parameters:');
      stmt.params.forEach((param, i) => {
        console.log(`  ${i}:`, param.name.kind);
        if (param.name.kind === 'ArrayPattern') {
          console.log('    Elements:', param.name.elements.map(e => e ? e.name || e.kind : 'hole').join(', '));
        } else if (param.name.kind === 'ObjectPattern') {
          console.log('    Properties:', param.name.properties.map(p => p.key.name).join(', '));
        } else {
          console.log('    Name:', param.name.name);
        }
      });
    }
  } catch (e) {
    console.error('Error:', e.message);
  }
}

// Test various destructuring patterns
testDestructuring(`function test([a, b]) { }`, 'Array destructuring');
testDestructuring(`function test({x, y}) { }`, 'Object destructuring');
testDestructuring(`function test({x: a, y: b}) { }`, 'Object destructuring with renaming');
testDestructuring(`function test([a, , c]) { }`, 'Array destructuring with hole');
testDestructuring(`function test({x, y: {z, w}}) { }`, 'Nested destructuring');
testDestructuring(`function test([{a, b}, [c, d]]) { }`, 'Mixed nested destructuring');