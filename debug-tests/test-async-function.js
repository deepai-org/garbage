const { Lexer } = require('../dist/lexer');
const { Parser } = require('../dist/parser');

const code = `async function processDataStream(source: DataSource) {
  results := []
  errors := []
}`;

console.log('Testing async function with short decls...\n');

const lexer = new Lexer(code);
const tokens = lexer.tokenize();
const parser = new Parser(tokens);

try {
    const ast = parser.parse();
    console.log('AST body length:', ast.body.length);
    
    if (ast.body[0]) {
        const func = ast.body[0];
        console.log('First node kind:', func.kind);
        
        if (func.kind === 'FuncDecl' && func.body) {
            console.log('Function has body with', func.body.statements?.length, 'statements');
            
            func.body.statements?.forEach((stmt, i) => {
                console.log(`  Statement ${i}: ${stmt.kind}`);
                if (stmt.kind === 'ShortDecl') {
                    console.log(`    - ${stmt.pairs[0].name?.name} := ...`);
                }
            });
        }
    }
} catch (e) {
    console.log('Parse error:', e.message);
}