const { Lexer } = require('../dist/lexer');
const { Parser } = require('../dist/parser');

const code = `case $option in
  "start")
    console.log("Starting")
    ;;
  "stop")
    echo "Stopping"
    ;;
  *)
    echo "Unknown"
    ;;
esac`;

console.log('Testing Bash case statement...\n');

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
            console.log('Has defaultCase:', !!switchStmt.defaultCase);
            
            switchStmt.cases?.forEach((c, i) => {
                console.log(`  Case ${i}:`, c.patterns?.[0]);
            });
            
            if (switchStmt.defaultCase) {
                console.log('  Default case exists');
            }
        }
    }
} catch (e) {
    console.log('Parse error:', e.message);
}