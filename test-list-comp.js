const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

function testListComp(code, description) {
  console.log(`\n${description}:`);
  console.log(`Code: ${code}`);
  
  try {
    const lexer = new Lexer(code);
    const tokens = lexer.tokenize();
    const parser = new Parser(tokens);
    const ast = parser.parse();
    
    const stmt = ast.body[0];
    if (stmt.kind === 'ConstDecl' || stmt.kind === 'VarDecl') {
      const comp = stmt.values[0];
      
      if (comp.kind === 'ListComprehension') {
        console.log('List comprehension found!');
        console.log('  Expression:', comp.expression.kind);
        if (comp.expression.kind === 'Binary') {
          console.log('    -', comp.expression.left.name || comp.expression.left.value, 
                      comp.expression.op, 
                      comp.expression.right.value || comp.expression.right.name);
        }
        console.log('  Target:', comp.target.name);
        console.log('  Iterable:', comp.iterable.kind);
        if (comp.filter) {
          console.log('  Filter:', comp.filter.kind);
          if (comp.filter.kind === 'Binary') {
            console.log('    -', comp.filter.left.name || comp.filter.left.value,
                        comp.filter.op,
                        comp.filter.right.value || comp.filter.right.name);
          }
        }
      } else {
        console.log('Not a list comprehension:', comp.kind);
      }
    }
  } catch (e) {
    console.error('Error:', e.message);
    console.error('Stack:', e.stack);
  }
}

// Test various list comprehension forms
testListComp(`const doubled = [x * 2 for x in range(10)];`, 'Simple comprehension');
testListComp(`const evens = [x for x in numbers if x % 2 == 0];`, 'Comprehension with filter');
testListComp(`const pairs = [x + y for x in range(3) if x > 0];`, 'Complex expression');