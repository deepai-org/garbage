const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

function testDecorators(code, description) {
  console.log(`\n${description}:`);
  console.log(`Code: ${code}`);
  
  try {
    const lexer = new Lexer(code);
    const tokens = lexer.tokenize();
    const parser = new Parser(tokens);
    const ast = parser.parse();
    
    const decl = ast.body[0];
    console.log('Declaration kind:', decl.kind);
    
    if (decl.decorators) {
      console.log('Decorators:');
      decl.decorators.forEach(dec => {
        console.log(`  - @${dec.name.name}${dec.args ? '(' + dec.args.length + ' args)' : ''}`);
      });
    } else {
      console.log('No decorators');
    }
    
    // Check for parameter decorators
    if (decl.params) {
      decl.params.forEach((param, i) => {
        if (param.decorators) {
          console.log(`Parameter ${i} (${param.name.name}) decorators:`);
          param.decorators.forEach(dec => {
            console.log(`  - @${dec.name.name}${dec.args ? '(' + dec.args.length + ' args)' : ''}`);
          });
        }
      });
    }
    
    // Check for class member decorators
    if (decl.members) {
      decl.members.forEach((member, i) => {
        if (member.decorators) {
          console.log(`Member ${i} (${member.name?.name || member.kind}) decorators:`);
          member.decorators.forEach(dec => {
            console.log(`  - @${dec.name.name}${dec.args ? '(' + dec.args.length + ' args)' : ''}`);
          });
        }
      });
    }
  } catch (e) {
    console.error('Error:', e.message);
  }
}

// Test various decorator types
testDecorators(`
@deprecated
@memoize
function calculate(x: number): number {
  return x * 2;
}`, 'Function decorators');

testDecorators(`function validate(@NotNull @Range(0, 100) value: number) { }`, 'Parameter decorators');

testDecorators(`
@Component
class MyComponent {
  @Input() title: string;
  
  @HostListener('click')
  onClick() { }
}`, 'Class and member decorators');