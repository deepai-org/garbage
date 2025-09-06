const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

// Detailed trace of parseStatement
const originalParseStatement = Parser.prototype.parseStatement;
Parser.prototype.parseStatement = function() {
    const token = this.peek();
    if (token?.value === 'select') {
        console.log('\nparseStatement handling select...');
        try {
            const result = originalParseStatement.call(this);
            console.log('  Success! Result:', result?.kind);
            return result;
        } catch (error) {
            console.log('  ERROR:', error.message);
            throw error;
        }
    }
    return originalParseStatement.call(this);
};

// Trace parseSelectStatement
const originalParseSelectStatement = Parser.prototype.parseSelectStatement;
if (originalParseSelectStatement) {
    Parser.prototype.parseSelectStatement = function() {
        console.log('  parseSelectStatement called');
        console.log('    Current token:', this.peek()?.value);
        try {
            const result = originalParseSelectStatement.call(this);
            console.log('  parseSelectStatement succeeded');
            return result;
        } catch (error) {
            console.log('  parseSelectStatement ERROR:', error.message);
            throw error;
        }
    };
}

// EXACT failing code
const code = `async fn processStream<T>(input: Stream<T>) -> Result<Vec<T>, Error> {
  async for await (const item of input) {
    select {
      case ch <- item:
        continue
      default:
        await sleep(100)
    }
  }
  
  return Ok(results)
}`;

console.log('Testing select parsing with error handling...\n');

try {
    const lexer = new Lexer(code);
    const tokens = lexer.tokenize();
    const parser = new Parser(tokens);
    const ast = parser.parse();
    
    console.log('\n✅ Parsed');
    console.log('AST body:', ast.body.length);
    
} catch (error) {
    console.error('\n❌ Parse error:', error.message);
}