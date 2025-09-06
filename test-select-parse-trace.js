const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

// Inject debugging at multiple levels
const originalParseTopLevel = Parser.prototype.parseTopLevel;
Parser.prototype.parseTopLevel = function() {
    const token = this.peek();
    if (token?.value === 'select') {
        console.log('  parseTopLevel sees "select"');
    }
    const result = originalParseTopLevel.call(this);
    if (token?.value === 'select') {
        console.log('  parseTopLevel result:', result?.kind || 'null');
    }
    return result;
};

const originalParseStatement = Parser.prototype.parseStatement;
Parser.prototype.parseStatement = function() {
    const token = this.peek();
    if (token?.value === 'select') {
        console.log('    parseStatement sees "select"');
    }
    const result = originalParseStatement.call(this);
    if (token?.value === 'select') {
        console.log('    parseStatement result:', result?.kind || 'null');
    }
    return result;
};

const originalParseBlock = Parser.prototype.parseBlock;
let blockId = 0;
Parser.prototype.parseBlock = function() {
    blockId++;
    const id = blockId;
    const token = this.peek();
    console.log(`parseBlock #${id} starts with: ${token?.value}`);
    
    const result = originalParseBlock.call(this);
    console.log(`parseBlock #${id} got ${result.statements?.length || 0} statements`);
    if (result.statements?.length === 0 && token?.value === '{') {
        const next = this.tokens?.[this.current - result.statements.length - 1];
        console.log(`  Empty block! Next token after { was: ${next?.value}`);
    }
    return result;
};

// Test problematic code
const code = `fn test() {
  for i := 0; i < 10; i++ {
    go async () => {
      x := 1  
    }()
  }
  
  async for await (const item of input) {
    select {
      case ch <- item:
        continue
    }
  }
}`;

console.log('Tracing select parsing in async for block...\n');

try {
    const lexer = new Lexer(code);
    const tokens = lexer.tokenize();
    const parser = new Parser(tokens);
    const ast = parser.parse();
    
    console.log('\n✅ Parsed');
} catch (error) {
    console.error('\n❌ Error:', error.message);
}