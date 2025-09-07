const { Lexer } = require('../dist/lexer');
const { Parser } = require('../dist/parser');

const code = `case $option in
  "start")
    echo "Starting"
    ;;
  "stop")
    echo "Stopping"
    ;;
  *)
    echo "Default"
    ;;
esac`;

console.log('Testing switch/case statement with simpler code...\n');

const lexer = new Lexer(code);
const tokens = lexer.tokenize();
const parser = new Parser(tokens);
const ast = parser.parse();

console.log('AST body count:', ast.body.length);

if (ast.body[0]) {
    const stmt = ast.body[0];
    console.log('Statement kind:', stmt.kind);
    
    if (stmt.kind === 'Switch') {
        console.log('Discriminant:', JSON.stringify(stmt.discriminant));
        console.log('Number of cases:', stmt.cases?.length);
        console.log('Has default case:', !!stmt.defaultCase);
        
        if (stmt.cases) {
            stmt.cases.forEach((c, i) => {
                console.log(`\nCase ${i}:`);
                console.log('  Patterns:', c.patterns ? c.patterns.map(p => JSON.stringify(p)) : 'none');
                console.log('  Body statements:', c.body?.statements?.length);
                console.log('  Fallthrough:', c.fallthrough);
            });
        }
        
        if (stmt.defaultCase) {
            console.log('\nDefault case:');
            console.log('  Body statements:', stmt.defaultCase.statements?.length);
        }
    }
}