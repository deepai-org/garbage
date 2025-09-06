const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

const code = `async fn processStream<T>(input: Stream<T>) -> Result<Vec<T>, Error> {}`;

console.log('Testing generic params...\n');

try {
    const lexer = new Lexer(code);
    const tokens = lexer.tokenize();
    const parser = new Parser(tokens);
    const ast = parser.parse();
    
    const func = ast.body[0];
    console.log('Function:', func.name.name);
    console.log('\nGeneric params fields:');
    console.log('  genericParams:', func.genericParams);
    console.log('  typeParams:', func.typeParams);
    
    // Check which field has the data
    if (func.genericParams) {
        console.log('\n✅ Using genericParams:', func.genericParams.map(p => p.name));
    }
    if (func.typeParams) {
        console.log('\n✅ Using typeParams:', func.typeParams.map(p => p.name));
    }
    
} catch (error) {
    console.error('Error:', error.message);
}