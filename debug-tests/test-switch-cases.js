const { Lexer } = require('../dist/lexer');
const { Parser } = require('../dist/parser');

const code = `
# Bash case with JavaScript template literals and arrow functions
case $option in
  "start")
    console.log(\`Starting service...\`)
    handler = () => console.log("Started")
    handler()
    ;;
  "stop")
    echo "Stopping..."
    ;;
  *)
    throw new Error("Unknown option")
    ;;
esac
`;

console.log('Testing switch/case statement...\n');

const lexer = new Lexer(code);
const tokens = lexer.tokenize();
const parser = new Parser(tokens);
const ast = parser.parse();

console.log('AST body count:', ast.body.length);

if (ast.body[0]) {
    const stmt = ast.body[0];
    console.log('Statement kind:', stmt.kind);
    
    if (stmt.kind === 'Switch') {
        console.log('Number of cases:', stmt.cases?.length);
        
        if (stmt.cases) {
            stmt.cases.forEach((c, i) => {
                console.log(`\nCase ${i}:`);
                console.log('  Pattern:', c.pattern ? JSON.stringify(c.pattern) : 'null (default)');
                console.log('  Has body:', !!c.body);
                if (c.body && c.body.kind === 'Block') {
                    console.log('  Body statements:', c.body.statements?.length);
                }
            });
        }
    }
}

console.log('\nParser errors:', parser.errors.length);
if (parser.errors.length > 0) {
    parser.errors.forEach(err => {
        console.log('Error:', err.message);
    });
}