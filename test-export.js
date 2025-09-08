const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

function testExport(code, description) {
  console.log(`\n${description}:`);
  console.log(`Code: ${code}`);
  
  try {
    const lexer = new Lexer(code);
    const tokens = lexer.tokenize();
    const parser = new Parser(tokens);
    const ast = parser.parse();
    
    const exportDecl = ast.body[0];
    console.log('Export kind:', exportDecl.kind);
    
    if (exportDecl.kind === 'ExportDecl') {
      console.log('isDefault:', exportDecl.isDefault);
      
      if (exportDecl.declaration) {
        console.log('Declaration kind:', exportDecl.declaration.kind);
        if (exportDecl.declaration.name) {
          console.log('Declaration name:', exportDecl.declaration.name.name);
        }
      }
      
      if (exportDecl.specifiers) {
        console.log('Specifiers:');
        exportDecl.specifiers.forEach(spec => {
          console.log(`  - ${spec.local.name}${spec.exported ? ' as ' + spec.exported.name : ''}`);
        });
      }
      
      if (exportDecl.source) {
        console.log('Source:', exportDecl.source);
      }
    }
  } catch (e) {
    console.error('Error:', e.message);
  }
}

// Test various export types
testExport(`export default class MyClass { }`, 'Default class export');
testExport(`export default function myFunc() { }`, 'Default function export');
testExport(`export { foo, bar as baz } from 'module';`, 'Re-export with rename');
testExport(`export * from 'module';`, 'Re-export all');
testExport(`export const value = 42;`, 'Named export');