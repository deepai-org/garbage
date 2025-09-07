const { Lexer } = require('../dist/lexer');
const { Parser } = require('../dist/parser');

// Test exact signature from failing test
const code = `fn deepNest<T, U, V>(x: Option<Result<Vec<(T, U)>, Error>>) -> Box<dyn Future<Item = V>> {}`;

console.log('Testing exact signature...\n');

const lexer = new Lexer(code);
const tokens = lexer.tokenize();

console.log('Key tokens:');
tokens.forEach((t, i) => {
    if (i < 35 || t.value === '->' || t.value === '{}' || t.value === '{' || t.value === '}') {
        console.log(`[${i}] "${t.value}" (${t.type})`);
    }
});

const parser = new Parser(tokens);

try {
    const ast = parser.parse();
    console.log('\nParse result:');
    console.log('AST body length:', ast.body.length);
    if (ast.body.length > 0) {
        const node = ast.body[0];
        console.log('Kind:', node?.kind);
        if (node?.kind === 'ExprStmt') {
            console.log('Expr kind:', node.expr?.kind);
            if (node.expr?.kind === 'Lambda') {
                console.log('  Lambda has params:', node.expr.params?.length);
            }
        } else if (node?.kind === 'FuncDecl') {
            console.log('SUCCESS! Function name:', node.name?.name);
            console.log('  Has return type:', !!node.returnType);
            console.log('  Generic params:', node.genericParams?.length);
        }
    } else {
        console.log('AST body is empty!');
    }
} catch (e) {
    console.log('\nParse error:', e.message);
    console.log('Stack:', e.stack);
}