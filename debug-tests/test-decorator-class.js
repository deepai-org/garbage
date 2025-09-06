const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

// Test decorator + class combinations
const tests = [
    {
        name: "Decorator on class",
        code: `@observer
class Component {
  render() { }
}`
    },
    {
        name: "Decorator on function",
        code: `@deprecated
function oldMethod() { }`
    },
    {
        name: "Multiple decorators",
        code: `@injectable
@singleton
class Service { }`
    },
    {
        name: "Decorator with args",
        code: `@Component({ selector: 'app' })
class AppComponent { }`
    }
];

tests.forEach(test => {
    console.log(`\n=== ${test.name} ===`);
    
    try {
        const lexer = new Lexer(test.code);
        const tokens = lexer.tokenize();
        const parser = new Parser(tokens);
        const ast = parser.parse();
        
        console.log('AST nodes:', ast.body.length);
        
        ast.body.forEach((node, i) => {
            console.log(`\n[${i}]: ${node.kind}`);
            
            if (node.kind === 'ClassDecl') {
                console.log('  Name:', node.name.name);
                console.log('  Has decorators?', !!node.decorators);
                if (node.decorators) {
                    console.log('  Decorator count:', node.decorators.length);
                }
            } else if (node.kind === 'FuncDecl') {
                console.log('  Name:', node.name.name);
                console.log('  Has decorators?', !!node.decorators);
            } else if (node.kind === 'ExprStmt') {
                console.log('  Expression:', node.expr.kind);
                if (node.expr.kind === 'Identifier') {
                    console.log('    Name:', node.expr.name);
                } else if (node.expr.kind === 'Unary' && node.expr.op === '@') {
                    console.log('    Op: @');
                    console.log('    Argument:', node.expr.argument?.kind);
                }
            }
        });
    } catch (e) {
        console.log('❌ Error:', e.message);
    }
});