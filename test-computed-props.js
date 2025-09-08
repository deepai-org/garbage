const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

function testComputedProps(code, description) {
  console.log(`\n${description}:`);
  console.log(`Code: ${code}`);
  
  try {
    const lexer = new Lexer(code);
    const tokens = lexer.tokenize();
    const parser = new Parser(tokens);
    const ast = parser.parse();
    
    const stmt = ast.body[0];
    if (stmt.kind === 'ConstDecl' || stmt.kind === 'VarDecl') {
      const objLiteral = stmt.values[0];
      
      if (objLiteral.kind === 'ObjectLiteral') {
        console.log('Properties:');
        objLiteral.properties.forEach(prop => {
          if (prop.computed) {
            const keyType = prop.key.kind;
            const keyDesc = keyType === 'Identifier' ? prop.key.name :
                           keyType === 'Member' ? `${prop.key.object.name}.${prop.key.property.name}` :
                           keyType === 'Binary' ? `${prop.key.left.name} ${prop.key.op} ${prop.key.right.value || prop.key.right.name}` :
                           keyType;
            console.log(`  - [${keyDesc}]: ${prop.value.kind} (computed)`);
          } else {
            const keyName = prop.key.name || prop.key.value;
            console.log(`  - ${keyName}: ${prop.value.kind}`);
          }
        });
      }
    }
  } catch (e) {
    console.error('Error:', e.message);
  }
}

// Test various computed property forms
testComputedProps(`const obj = { [key]: value };`, 'Simple computed property');
testComputedProps(`const obj = { [Symbol.iterator]: fn };`, 'Symbol computed property');
testComputedProps(`const obj = { ["prop" + index]: value };`, 'Expression computed property');
testComputedProps(`const obj = { regular: 1, [computed]: 2, "string": 3 };`, 'Mixed property types');