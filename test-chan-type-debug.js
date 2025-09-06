const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

const code = `const ch = make(chan<JSX.Element>)`;

console.log('Debugging chan<T> type parsing...\n');
console.log('Code:', code);

// Add debug logging to parser
const originalParse = Parser.prototype.parse;
let typeNodeCreated = null;

Parser.prototype.parseType = function() {
    const oldParseType = Object.getPrototypeOf(this).parseType;
    const result = oldParseType.call(this);
    
    if (result && result.kind === 'GenericType' && result.base.name === 'chan') {
        console.log('\n🔍 GenericType created for chan<T>:');
        console.log('  Kind:', result.kind);
        console.log('  Base:', result.base.name);
        console.log('  Args:', result.args.length);
        typeNodeCreated = result;
    }
    
    return result;
};

try {
    const lexer = new Lexer(code);
    const tokens = lexer.tokenize();
    
    const parser = new Parser(tokens);
    const ast = parser.parse();
    
    console.log('\n✅ Parsed successfully!');
    
    const decl = ast.body[0];
    const makeCall = decl.values[0];
    
    console.log('\nMake call analysis:');
    console.log('  Has _typeNode:', !!makeCall._typeNode);
    console.log('  First arg name:', makeCall.args[0].name);
    
    if (typeNodeCreated) {
        console.log('\nGenericType was created but not stored in _typeNode');
        console.log('Need to check why the condition failed in parsePostfix');
    }
    
} catch (error) {
    console.error('\n❌ Parser error:', error.message);
}