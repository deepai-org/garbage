const { Lexer } = require('../dist/lexer');
const { Parser } = require('../dist/parser');

// Monkey patch to trace parsing
const originalParse = Parser.prototype.parse;
Parser.prototype.parse = function() {
    console.log('[parse] Starting parse...');
    const result = originalParse.call(this);
    console.log('[parse] Finished, body length:', result.body.length);
    return result;
};

const originalParseTopLevel = Parser.prototype.parseTopLevel;
Parser.prototype.parseTopLevel = function() {
    const token = this.peek();
    console.log(`[parseTopLevel] at ${this.current}: "${token?.value}" (${token?.type})`);
    
    if (token?.value === '@') {
        console.log('  Found decorator!');
    }
    
    try {
        const result = originalParseTopLevel.call(this);
        console.log(`[parseTopLevel] returned: ${result?.kind}`);
        return result;
    } catch (e) {
        console.log(`[parseTopLevel] error: ${e.message}`);
        return null;
    }
};

const code = `@dataclass
class Container<T> extends Base implements IContainer<T> with Sortable {
}`;

console.log('Testing with trace...\n');

const lexer = new Lexer(code);
const tokens = lexer.tokenize();
const parser = new Parser(tokens);

const ast = parser.parse();
console.log('\nFinal AST body:', ast.body.length);