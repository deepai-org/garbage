const { Lexer } = require('../dist/lexer');
const { Parser } = require('../dist/parser');

// Exact structure from deep nest
const code = `match x {
  Some(Ok(vec)) => {
    Box::new(async move {
      println!("test")
    })
  }
  _ => other
}`;

console.log('Testing match with async move...\n');

const lexer = new Lexer(code);
const tokens = lexer.tokenize();

// Check tokens
let asyncIndex = tokens.findIndex(t => t.value === 'async');
if (asyncIndex >= 0) {
    console.log('Tokens around async:');
    for (let i = Math.max(0, asyncIndex - 3); i < Math.min(asyncIndex + 10, tokens.length); i++) {
        const t = tokens[i];
        if (t.type !== 'WHITESPACE') {
            console.log(`[${i}] "${t.value}" (${t.type})${i === asyncIndex ? ' <--' : ''}`);
        }
    }
}

const parser = new Parser(tokens);

try {
    const ast = parser.parse();
    console.log('\nAST body count:', ast.body.length);
    const match = ast.body[0];
    console.log('First statement:', match?.kind);
    console.log('Arms count:', match?.arms?.length);
} catch (e) {
    console.log('\nParse error:', e.message, 'at position', parser.current);
}