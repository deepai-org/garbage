const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

const code = `match value {
  Some(x) if x > 0 => "positive"
  Some(x) => "non-positive"
  None => "empty"
}`;

console.log('Testing match with guard...\n');

const lexer = new Lexer(code);
const tokens = lexer.tokenize();
const parser = new Parser(tokens);
const ast = parser.parse();

console.log('Parsed successfully:', ast.body.length > 0);

if (ast.body[0]?.kind === 'Match') {
    const match = ast.body[0];
    console.log('\nMatch arms:', match.arms.length);
    
    match.arms.forEach((arm, i) => {
        console.log(`\nArm ${i}:`);
        console.log('  Pattern:', arm.patterns[0]?.kind);
        console.log('  Has guard:', !!arm.guard);
        if (arm.guard) {
            console.log('  Guard type:', arm.guard.kind);
            if (arm.guard.kind === 'Binary') {
                console.log('    Operator:', arm.guard.op);
                console.log('    Left:', arm.guard.left?.name || arm.guard.left?.kind);
                console.log('    Right:', arm.guard.right?.value || arm.guard.right?.kind);
            }
        }
    });
}