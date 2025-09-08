const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

function testFunctionType(code, description) {
  console.log(`\n${description}:`);
  console.log(`Code: ${code}`);
  
  try {
    const lexer = new Lexer(code);
    const tokens = lexer.tokenize();
    const parser = new Parser(tokens);
    const ast = parser.parse();
    
    const stmt = ast.body[0];
    if (stmt.kind === 'TypeDecl' || stmt.kind === 'VarDecl' || stmt.kind === 'ConstDecl') {
      console.log('Declaration found:', stmt.kind);
      
      let type;
      if (stmt.kind === 'TypeDecl') {
        type = stmt.definition;
      } else if (stmt.values && stmt.values[0]) {
        // For variable declarations with type annotations
        type = stmt.type || (stmt.values[0] && stmt.values[0].type);
      }
      
      if (type && type.kind === 'FuncType') {
        console.log('Function type found!');
        console.log('  Parameters:');
        type.params.forEach((param, i) => {
          const name = param.name ? param.name.name : '<unnamed>';
          const typeName = param.type ? param.type.kind : 'none';
          const optional = param.optional ? ' (optional)' : '';
          console.log(`    ${i}: name="${name}", type=${typeName}${optional}`);
        });
        console.log('  Return type:', type.ret ? type.ret.kind : 'none');
      } else if (type) {
        console.log('Type kind:', type.kind);
      }
    }
  } catch (e) {
    console.error('Error:', e.message);
    console.error('Stack:', e.stack);
  }
}

// Test various function type declarations
console.log('=== Testing Function Type Parameter Names ===');
testFunctionType(`type Callback = (event: Event, data: string) => void;`, 'Named parameters in type');
testFunctionType(`type Handler = (e: MouseEvent) => boolean;`, 'Single named parameter');
testFunctionType(`type Compute = (x: number, y: number, z: number) => number;`, 'Multiple named parameters');
testFunctionType(`type Process = (input: string, options?: Config) => Result;`, 'Optional parameter');

// Also test inline function types
testFunctionType(`let handler: (event: Event, callback: Function) => void;`, 'Inline function type');
testFunctionType(`const processor: (data: any, transform: (x: any) => any) => any;`, 'Nested function types');