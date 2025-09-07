const { Lexer } = require('../dist/lexer');
const { Parser } = require('../dist/parser');

// Exact signature from the test
const code = `fn deepNest<T, U, V>(x: Option<Result<Vec<(T, U)>, Error>>) -> Box<dyn Future<Item = V>> {
  match x {
    Some(v) => v
    None => 0
  }
}`;

console.log('Testing with exact signature...\n');

const lexer = new Lexer(code);
const tokens = lexer.tokenize();
const parser = new Parser(tokens);

try {
    const ast = parser.parse();
    console.log('Top-level nodes:', ast.body.length);
    
    if (ast.body[0]?.kind === 'FuncDecl') {
        const func = ast.body[0];
        console.log('Function statements:', func.body?.statements?.length);
        const match = func.body?.statements?.[0];
        if (match?.kind === 'Match') {
            console.log('Match arms:', match.arms?.length);
        }
    }
    
    if (ast.body[1]) {
        console.log('\nERROR: Unexpected second top-level node:', ast.body[1].kind);
        if (ast.body[1].kind === 'ExprStmt' && ast.body[1].expr?.kind === 'Lambda') {
            const lambda = ast.body[1].expr;
            console.log('Lambda params:', lambda.params?.map(p => p.name?.name));
        }
    }
} catch (e) {
    console.log('Parse error:', e.message);
}