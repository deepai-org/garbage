const { Lexer } = require('../dist/lexer');
const { Parser } = require('../dist/parser');

const code = `def foo
  items.each do |item|
    puts item
  end
end`;

const lexer = new Lexer(code);
const tokens = lexer.tokenize();

// Test what parseTopLevel does starting from position 3
console.log('Testing parseTopLevel from position 3 (items)...\n');

const parser = new Parser(tokens);
parser.current = 3; // Start at 'items'

console.log('Before parseTopLevel:');
console.log('  current =', parser.current);
console.log('  token =', tokens[parser.current]?.value);

try {
    const stmt = parser.parseTopLevel();
    console.log('\nAfter parseTopLevel:');
    console.log('  current =', parser.current);
    console.log('  token =', tokens[parser.current]?.value);
    console.log('  Statement:', stmt?.kind || 'null');
    
    if (stmt) {
        console.log('  Statement type:', stmt.kind);
        if (stmt.kind === 'ExprStmt') {
            console.log('  Expression type:', stmt.expr.kind);
        }
    }
} catch (e) {
    console.log('Error:', e.message);
}