const { Lexer } = require('../dist/lexer');
const { Parser } = require('../dist/parser');

const code = `fn test() {
  match x {
    a => {
      async move { b }
    }
    c => d
  }
}`;

console.log('Testing match with async block inside function...\n');

const lexer = new Lexer(code);
const tokens = lexer.tokenize();
const parser = new Parser(tokens);

try {
    const ast = parser.parse();
    console.log('AST body count:', ast.body.length);
    
    if (ast.body[0]?.kind === 'FuncDecl') {
        const func = ast.body[0];
        console.log('Function body statements:', func.body?.statements?.length);
        const stmt = func.body?.statements?.[0];
        if (stmt) {
            console.log('First statement:', stmt.kind);
            if (stmt.kind === 'Match') {
                console.log('Match arms:', stmt.arms?.length);
            }
        }
    }
    
    // Check if there's a second top-level item
    if (ast.body[1]) {
        console.log('\nUnexpected second top-level item:', ast.body[1].kind);
    }
} catch (e) {
    console.log('Parse error:', e.message);
}