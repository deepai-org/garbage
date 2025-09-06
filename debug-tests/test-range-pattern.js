const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

// Test range patterns
const code = `match value {
  Some(x) => {
    case x when
      1..10) "single digit"
      11..99) "double digit"
      _) "large"
    esac
  }
  None => 0
}`;

console.log('Testing range patterns in case...\n');

const lexer = new Lexer(code);
const tokens = lexer.tokenize();

// Show tokens around ranges
console.log('Tokens around ranges:');
for (let i = 0; i < tokens.length; i++) {
    if (tokens[i].value === '..' || tokens[i].value === ')' || 
        (i > 0 && tokens[i-1].value === '..')) {
        console.log(`[${i}] ${tokens[i].value} (${tokens[i].type})`);
    }
}

console.log('\nParsing...');
try {
    const parser = new Parser(tokens);
    const ast = parser.parse();
    
    const node = ast.body[0];
    if (node?.kind === 'Match') {
        console.log('✅ Parsed as Match');
        console.log('  Arms:', node.arms.length);
    } else if (node?.kind === 'ExprStmt') {
        console.log('⚠️ Parsed as ExprStmt');
        console.log('  Expression:', node.expr.kind);
    }
} catch (e) {
    console.log('❌ Parse error:', e.message);
}