const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

function testObjectType(code, description) {
  console.log(`\n${description}:`);
  console.log(`Code: ${code}`);
  
  try {
    const lexer = new Lexer(code);
    const tokens = lexer.tokenize();
    const parser = new Parser(tokens);
    const ast = parser.parse();
    
    const typeDecl = ast.body[0];
    console.log('Declaration kind:', typeDecl.kind);
    
    if (typeDecl.kind === 'TypeDecl') {
      const objType = typeDecl.definition;
      console.log('Type kind:', objType.kind);
      
      if (objType.kind === 'ObjectType') {
        console.log('Properties:');
        objType.properties.forEach(prop => {
          const flags = [];
          if (prop.optional) flags.push('optional');
          if (prop.readonly) flags.push('readonly');
          const flagStr = flags.length > 0 ? ` (${flags.join(', ')})` : '';
          console.log(`  - ${prop.name}: ${prop.type.kind}${flagStr}`);
        });
      }
    }
  } catch (e) {
    console.error('Error:', e.message);
  }
}

// Test various object type forms
testObjectType(`type User = { name: string, age: number };`, 'Simple object type');
testObjectType(`type Config = { readonly host: string, port?: number };`, 'Object with modifiers');
testObjectType(`type Nested = { user: { id: number, name: string }, active: boolean };`, 'Nested object type');