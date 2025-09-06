const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

const code = `// Panic/recover (Go-style)
defer recover()
panic("error")`;

console.log('Testing defer recover...\n');

const lexer = new Lexer(code);
const tokens = lexer.tokenize();
const parser = new Parser(tokens);
const ast = parser.parse();

console.log('AST nodes:', ast.body.length);

// Find defer statements
const findByKind = (ast, kind) => {
    const results = [];
    const traverse = (n) => {
        if (!n) return;
        if (n.kind === kind) {
            results.push(n);
        }
        for (const key in n) {
            if (key !== 'span' && n[key]) {
                if (Array.isArray(n[key])) {
                    n[key].forEach(traverse);
                } else if (typeof n[key] === 'object') {
                    traverse(n[key]);
                }
            }
        }
    };
    traverse(ast);
    return results;
};

const deferStmts = findByKind(ast, 'Defer');
console.log('Defer statements found:', deferStmts.length);

if (deferStmts.length > 0) {
    console.log('\nFirst defer:', JSON.stringify(deferStmts[0], null, 2).substring(0, 500));
}