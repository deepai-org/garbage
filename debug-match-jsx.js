const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

const code = `function render_user(user: Option<User>) {
    match user {
        Some(u) => <UserCard name={u.name} email={u.email} />
        None => <EmptyState message="No user found" />
    }
}`;

console.log('Code:', code);

const lexer = new Lexer(code);
const tokens = lexer.tokenize();
const parser = new Parser(tokens);
const ast = parser.parse();

console.log('\n--- AST ---');
console.log('Body length:', ast.body.length);

if (ast.body.length > 0) {
    const func = ast.body[0];
    console.log('Function body statements:', func.body.statements.length);
    if (func.body.statements.length > 0) {
        const stmt = func.body.statements[0];
        console.log('First statement:', stmt);
    }
}
