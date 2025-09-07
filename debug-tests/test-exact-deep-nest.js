const { Lexer } = require('../dist/lexer');
const { Parser } = require('../dist/parser');

const code = `fn deepNest<T, U, V>(x: Option<Result<Vec<(T, U)>, Error>>) -> Box<dyn Future<Item = V>> {
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
    _ => Box::new(future::err(Error::new("failed")))
  }
}`;

console.log('Testing exact deep nest function...\n');

const lexer = new Lexer(code);
const tokens = lexer.tokenize();

// Find the match keyword and the following tokens
let matchIndex = tokens.findIndex(t => t.value === 'match');
if (matchIndex >= 0) {
    console.log('Tokens around match:');
    for (let i = matchIndex; i < Math.min(matchIndex + 20, tokens.length); i++) {
        if (tokens[i].type !== 'WHITESPACE') {
            console.log(`[${i}] "${tokens[i].value}" (${tokens[i].type})`);
        }
    }
}

// Find the underscore pattern
let underscoreIndex = tokens.findIndex(t => t.value === '_');
if (underscoreIndex >= 0) {
    console.log('\nTokens around _ pattern:');
    for (let i = Math.max(0, underscoreIndex - 3); i < Math.min(underscoreIndex + 10, tokens.length); i++) {
        if (tokens[i].type !== 'WHITESPACE') {
            console.log(`[${i}] "${tokens[i].value}" (${tokens[i].type})${i === underscoreIndex ? ' <-- HERE' : ''}`);
        }
    }
}

const parser = new Parser(tokens);

try {
    const ast = parser.parse();
    console.log('\nTop-level AST body count:', ast.body.length);
    
    if (ast.body[0]?.kind === 'FuncDecl') {
        const func = ast.body[0];
        console.log('Function body statements:', func.body?.statements?.length);
        if (func.body?.statements?.[0]) {
            const stmt = func.body.statements[0];
            console.log('First statement:', stmt.kind);
            if (stmt.kind === 'Match') {
                console.log('Match arms:', stmt.arms?.length);
            }
        }
    }
} catch (e) {
    console.log('\nParse error:', e.message);
}