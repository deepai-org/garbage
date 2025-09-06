const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

const code = `@observer
@inject('store')
class TodoView:
    def render(self):
        return "hello"`;

console.log('Testing Python-style class with decorators...\n');

const lexer = new Lexer(code);
const tokens = lexer.tokenize();

console.log('Relevant tokens:');
for (let i = 0; i < Math.min(20, tokens.length); i++) {
    if (['@', 'observer', 'inject', 'class', 'TodoView', ':', 'def'].includes(tokens[i].value)) {
        console.log(`[${i}] "${tokens[i].value}" (${tokens[i].type})`);
    }
}

const parser = new Parser(tokens);
const ast = parser.parse();

console.log('\nAST nodes:', ast.body.length);
ast.body.forEach((node, i) => {
    console.log(`[${i}]: ${node.kind}`);
    if (node.kind === 'ClassDecl') {
        console.log('  Name:', node.name.name);
        console.log('  Decorators:', node.decorators ? node.decorators.length : 0);
    } else if (node.kind === 'ExprStmt') {
        console.log('  Expression:', node.expr.kind, node.expr.name || '');
    }
});