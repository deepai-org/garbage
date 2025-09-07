const { Lexer } = require('../dist/lexer');
const { Parser } = require('../dist/parser');

const code = `switch (x) {
  case 1:
    y = 'one';
    break;
  case 2:
    y = 'two';
    break;
  default:
    y = 'other';
}`;

console.log('Testing switch with default...\n');

const lexer = new Lexer(code);
const tokens = lexer.tokenize();
const parser = new Parser(tokens);

try {
    const ast = parser.parse();
    console.log('AST body length:', ast.body.length);
    
    if (ast.body[0]) {
        const switchStmt = ast.body[0];
        console.log('First node kind:', switchStmt.kind);
        
        if (switchStmt.kind === 'Switch') {
            console.log('Cases:', switchStmt.cases?.length);
            console.log('Has defaultCase field:', !!switchStmt.defaultCase);
            
            switchStmt.cases?.forEach((c, i) => {
                console.log(`  Case ${i}:`);
                console.log(`    Pattern:`, c.pattern?.kind || c.pattern);
                console.log(`    Has body:`, !!c.body);
            });
            
            if (switchStmt.defaultCase) {
                console.log('Default case:');
                console.log('  Has body:', !!switchStmt.defaultCase.body);
            }
        }
    }
} catch (e) {
    console.log('Parse error:', e.message);
}