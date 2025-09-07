const { Lexer } = require('../dist/lexer');
const { Parser } = require('../dist/parser');

const code = `@dataclass
class Container<T> extends Base implements IContainer<T> with Sortable {
  private items: Vec<T> = []
}`;

console.log('Testing complex decorated class...\n');

const lexer = new Lexer(code);
const tokens = lexer.tokenize();

console.log('First 20 tokens:');
for (let i = 0; i < Math.min(20, tokens.length); i++) {
    console.log(`[${i}] "${tokens[i].value}" (${tokens[i].type})`);
}

const parser = new Parser(tokens);
try {
    const ast = parser.parse();
    console.log('\nAST body length:', ast.body.length);
    if (ast.body[0]) {
        console.log('First node:', ast.body[0].kind);
        if (ast.body[0].kind === 'ClassDecl') {
            console.log('  Class name:', ast.body[0].name?.name);
            console.log('  Has decorators:', !!ast.body[0].decorators);
            console.log('  Generic params:', ast.body[0].genericParams?.length);
        }
    }
} catch (e) {
    console.log('\nParse error:', e.message);
    console.log('Stack:', e.stack);
}