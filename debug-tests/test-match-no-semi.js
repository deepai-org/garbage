const { Lexer } = require('../dist/lexer');
const { Parser } = require('../dist/parser');

// This mimics the structure in the deep nest function
const code = `match x {
  Some(Ok(vec)) => {
    Box::new(f)
  }
  _ => other
}`;

console.log('Testing match with complex first arm...\n');

const lexer = new Lexer(code);
const tokens = lexer.tokenize();

// Look for tokens around the closing brace
console.log('Tokens:');
for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (t.type !== 'WHITESPACE') {
        console.log(`[${i}] "${t.value}" (${t.type})${t.virtualSemi ? ' [virtualSemi]' : ''}`);
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
    console.log('\nParse error:', e.message);
}