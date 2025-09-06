const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

// Test nested case...esac
const code = `match value {
  Some(x) => {
    case x when
      1) "one"
      2) "two"
      _) "other"
    esac
  }
  None => 0
}`;

console.log('Testing nested case in match...\n');

const lexer = new Lexer(code);
const tokens = lexer.tokenize();

// Show some tokens
console.log('Key tokens:');
for (let i = 0; i < tokens.length && i < 30; i++) {
    if (['match', 'case', 'when', 'esac', '=>', '}'].includes(tokens[i].value)) {
        console.log(`[${i}] ${tokens[i].value}`);
    }
}

console.log('\nParsing...');
const parser = new Parser(tokens);
const ast = parser.parse();

const node = ast.body[0];
if (node?.kind === 'Match') {
    console.log('✅ Parsed as Match');
    console.log('  Arms:', node.arms.length);
} else {
    console.log('❌ Not parsed as Match:', node?.kind);
}