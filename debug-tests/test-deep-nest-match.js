const { Lexer } = require('../dist/lexer');
const { Parser } = require('../dist/parser');

// Simpler version of the nested match
const code = `match x {
  Some(Ok(vec)) => {
    Box::new(async move {
      println!("test")
    })
  }
  _ => Box::new(future::err(Error::new("failed")))
}`;

console.log('Testing match with nested blocks...\n');

const lexer = new Lexer(code);
const tokens = lexer.tokenize();
const parser = new Parser(tokens);

try {
    const ast = parser.parse();
    console.log('AST body count:', ast.body.length);
    ast.body.forEach((node, i) => {
        console.log(`Body[${i}]: ${node.kind}`);
        if (node.kind === 'Match' && node.arms) {
            console.log(`  Arms: ${node.arms.length}`);
            node.arms.forEach((arm, j) => {
                console.log(`  Arm ${j}: patterns = ${arm.patterns?.length}, body = ${arm.body?.kind}`);
            });
        }
    });
} catch (e) {
    console.log('Parse error:', e.message);
}