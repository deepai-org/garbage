const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

function testShortDecl(code, description) {
  console.log(`\n${description}:`);
  console.log(`Code: ${code}`);
  
  try {
    const lexer = new Lexer(code);
    const tokens = lexer.tokenize();
    const parser = new Parser(tokens);
    const ast = parser.parse();
    
    const stmt = ast.body[0];
    if (stmt && stmt.kind === 'ShortDecl') {
      console.log('Short declaration found:');
      console.log('  Targets:', stmt.targets ? stmt.targets.length : 0);
      
      if (stmt.targets && stmt.targets.length > 0) {
        stmt.targets.forEach((target, i) => {
          if (typeof target === 'string') {
            console.log(`    ${i}: Simple identifier "${target}"`);
          } else if (target.kind === 'Identifier') {
            console.log(`    ${i}: Identifier "${target.name}"`);
          } else if (target.kind === 'ArrayPattern') {
            console.log(`    ${i}: Array pattern with ${target.elements.length} elements`);
            target.elements.forEach((el, j) => {
              if (el.kind === 'Identifier') {
                console.log(`      [${j}]: "${el.name}"`);
              } else if (el.kind === 'ArrayPattern' || el.kind === 'ObjectPattern') {
                console.log(`      [${j}]: Nested ${el.kind}`);
              }
            });
          } else if (target.kind === 'ObjectPattern') {
            console.log(`    ${i}: Object pattern with ${target.properties.length} properties`);
            target.properties.forEach((prop, j) => {
              console.log(`      {${prop.key}}: ${prop.value.kind === 'Identifier' ? prop.value.name : prop.value.kind}`);
            });
          } else {
            console.log(`    ${i}: ${target.kind || 'Unknown'}`);
          }
        });
      }
      
      console.log('  Value:', stmt.value ? stmt.value.kind : 'none');
    } else {
      console.log('Statement kind:', stmt ? stmt.kind : 'null');
    }
  } catch (e) {
    console.error('Error:', e.message);
  }
}

console.log('=== Testing Destructuring in Short Declarations ===');

// Simple short declaration (baseline)
testShortDecl(`x := 10`, 'Simple short declaration');

// Multiple targets
testShortDecl(`x, y := 10, 20`, 'Multiple simple targets');

// Array destructuring
testShortDecl(`[a, b] := arr`, 'Array destructuring');

// Object destructuring
testShortDecl(`{name, age} := person`, 'Object destructuring');

// Mixed destructuring
testShortDecl(`x, [a, b], {name} := getValue()`, 'Mixed destructuring patterns');

// Nested array destructuring
testShortDecl(`[a, [b, c]] := nested`, 'Nested array destructuring');

// Nested object destructuring
testShortDecl(`{user: {name, id}} := data`, 'Nested object destructuring');

// Complex mixed case
testShortDecl(`result, [first, ...rest], {x, y} := process()`, 'Complex mixed destructuring');

// With rest/spread
testShortDecl(`[head, ...tail] := list`, 'Array destructuring with rest');

// Object with renamed properties
testShortDecl(`{name: userName, id: userId} := user`, 'Object destructuring with renaming');