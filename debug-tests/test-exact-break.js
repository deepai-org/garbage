const { Lexer } = require('../dist/lexer');
const { Parser } = require('../dist/parser');

// This is the exact code that breaks
const code = `fn test() {
  match x {
    Some(Ok(vec)) => {
      Box::new(async move {
        for (a, b) in vec.iter() {
          if a < b {
            yield process(a, b).await?
          }
        }
      })
    }
    _ => other
  }
}`;

console.log('Testing exact breaking case...\n');

const lexer = new Lexer(code);
const tokens = lexer.tokenize();

// Find all closing braces
const braces = [];
tokens.forEach((t, i) => {
    if (t.value === '}') {
        braces.push(i);
    }
});
console.log('Closing brace positions:', braces);

const parser = new Parser(tokens);

try {
    const ast = parser.parse();
    console.log('\nTop-level nodes:', ast.body.length);
    
    if (ast.body[0]?.kind === 'FuncDecl') {
        const func = ast.body[0];
        console.log('Function statements:', func.body?.statements?.length);
        const match = func.body?.statements?.[0];
        if (match?.kind === 'Match') {
            console.log('Match arms:', match.arms?.length);
        }
    }
    
    if (ast.body[1]) {
        console.log('\nERROR: Second top-level node:', ast.body[1].kind);
    }
} catch (e) {
    console.log('\nParse error:', e.message);
}