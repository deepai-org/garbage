const { Lexer } = require('../dist/lexer');
const { Parser } = require('../dist/parser');

const code = `fn orchestrate(tasks: []Task) {
  results := make(chan Result, len(tasks))
  errors := make(chan Error, 10)
  done := make(chan bool)
}`;

console.log('Testing simple orchestrate...\n');

const lexer = new Lexer(code);
const tokens = lexer.tokenize();
const parser = new Parser(tokens);

try {
    const ast = parser.parse();
    console.log('AST body length:', ast.body.length);
    
    ast.body.forEach((node, i) => {
        console.log(`\nNode ${i}:`, node.kind);
        if (node.kind === 'FuncDecl') {
            console.log('  Function name:', node.name?.name);
            console.log('  Has body:', !!node.body);
            if (node.body?.statements) {
                console.log('  Statements in body:', node.body.statements.length);
                node.body.statements.forEach((stmt, j) => {
                    console.log(`    Statement ${j}:`, stmt.kind);
                    if (stmt.kind === 'ShortDecl' && stmt.pairs?.[0]) {
                        console.log(`      ${stmt.pairs[0].name?.name} := ...`);
                    }
                });
            }
        }
    });
} catch (e) {
    console.log('Parse error:', e.message);
}