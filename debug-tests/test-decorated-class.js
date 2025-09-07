const { Lexer } = require('../dist/lexer');
const { Parser } = require('../dist/parser');

const code = `
@dataclass
class Container<T> extends Base implements IContainer<T> with Sortable {
  private items: Vec<T> = []
}
`;

console.log('Testing decorated class...\n');

const lexer = new Lexer(code);
const tokens = lexer.tokenize();
const parser = new Parser(tokens);

try {
    const ast = parser.parse();
    console.log('AST body length:', ast.body.length);
    if (ast.body.length > 0) {
        console.log('First node kind:', ast.body[0]?.kind);
        if (ast.body[0]?.kind === 'ClassDecl') {
            console.log('Class name:', ast.body[0].name?.name);
            console.log('Has decorators:', !!ast.body[0].decorators);
        }
    }
} catch (e) {
    console.log('Parse error:', e.message);
}