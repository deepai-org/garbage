const { Lexer } = require('../dist/lexer');
const { Parser } = require('../dist/parser');

const code = `match x {
  Some(Ok(vec)) => {
    println!("found vec")
  }
  _ => Box::new(future::err(Error::new("failed")))
}`;

console.log('Testing match with multiple arms...\n');

const lexer = new Lexer(code);
const tokens = lexer.tokenize();
const parser = new Parser(tokens);

try {
    const ast = parser.parse();
    const match = ast.body[0];
    console.log('Match arms count:', match.arms?.length || 0);
    if (match.arms) {
        match.arms.forEach((arm, i) => {
            console.log(`Arm ${i}: patterns =`, arm.patterns?.map(p => p.kind));
        });
    }
    console.log('\nAST body count:', ast.body.length);
    ast.body.forEach((node, i) => {
        console.log(`Body[${i}]: ${node.kind}`);
    });
} catch (e) {
    console.log('Parse error:', e.message);
}