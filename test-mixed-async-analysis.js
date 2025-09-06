const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');
const util = require('util');

const code = `
# Mixing async/await, goroutines, and channels
async fn processStream<T>(input: Stream<T>) -> Result<Vec<T>, Error> {
  results := []
  ch := make(chan T, 100)
  
  // Spawn multiple workers
  for i := 0; i < 10; i++ {
    go async () => {
      while item := <-ch {
        processed := await transform(item)
        results.push(processed)
      }
    }()
  }
  
  // Feed the channel
  async for await (const item of input) {
    select {
      case ch <- item:
        continue
      default:
        await sleep(100)
    }
  }
  
  return Ok(results)
}
`;

console.log('===========================================');
console.log('ANALYZING: Mixed Async/Concurrent Patterns');
console.log('===========================================\n');

console.log('WHAT THE TEST CURRENTLY CHECKS:');
console.log('--------------------------------');
console.log('✓ Code parses without throwing error');
console.log('✓ AST has at least 1 node');
console.log('');
console.log('That\'s it! No verification of:');
console.log('✗ Generic type parsing (<T>, Stream<T>, Vec<T>)');
console.log('✗ Channel operations (<-ch, ch <- item)');
console.log('✗ Async/await structures');
console.log('✗ Go routines');
console.log('✗ Select statements\n');

try {
    const lexer = new Lexer(code);
    const tokens = lexer.tokenize();
    const parser = new Parser(tokens);
    const ast = parser.parse();
    
    console.log('ACTUAL PARSING RESULTS:');
    console.log('-----------------------');
    console.log(`AST nodes parsed: ${ast.body.length}`);
    
    // Let's see what actually got parsed
    if (ast.body.length > 0) {
        const firstNode = ast.body[0];
        console.log(`First node type: ${firstNode.kind}`);
        
        if (firstNode.kind === 'FuncDecl') {
            console.log(`Function name: ${firstNode.name.name}`);
            console.log(`Has async modifier: ${firstNode.modifiers?.includes('async')}`);
            console.log(`Generic params: ${firstNode.genericParams ? 'YES' : 'NO'}`);
            
            if (firstNode.genericParams) {
                console.log(`  Generic param count: ${firstNode.genericParams.length}`);
                console.log(`  First generic: ${firstNode.genericParams[0].name}`);
            }
            
            if (firstNode.params) {
                console.log(`Parameters: ${firstNode.params.length}`);
                const firstParam = firstNode.params[0];
                if (firstParam.type) {
                    console.log(`  First param type: ${firstParam.type.kind}`);
                    if (firstParam.type.kind === 'GenericType') {
                        console.log(`    Generic base: ${firstParam.type.base.name}`);
                        console.log(`    Generic args: ${firstParam.type.args.length}`);
                    }
                }
            }
            
            if (firstNode.returnType) {
                console.log(`Return type: ${firstNode.returnType.kind}`);
                if (firstNode.returnType.kind === 'GenericType') {
                    console.log(`  Generic base: ${firstNode.returnType.base.name}`);
                }
            }
        }
        
        console.log('\nFull AST structure (depth 2):');
        console.log(util.inspect(ast.body[0], { depth: 2, colors: false, maxArrayLength: 3 }));
    }
    
    // Now let's check for angle bracket disambiguation
    console.log('\n\nANGLE BRACKET DISAMBIGUATION CHECK:');
    console.log('------------------------------------');
    
    // Count angle brackets in source
    const ltCount = (code.match(/</g) || []).length;
    const gtCount = (code.match(/>/g) || []).length;
    console.log(`Source contains: ${ltCount} '<' and ${gtCount} '>' characters`);
    
    // These should be parsed as:
    console.log('\nExpected interpretations:');
    console.log('  Stream<T> - Generic type (1)');
    console.log('  Result<Vec<T>, Error> - Nested generic (2)');
    console.log('  Vec<T> - Generic type (1)');  
    console.log('  i < 10 - Comparison (1)');
    console.log('  <-ch - Channel receive (1)');
    console.log('  ch <- item - Channel send (1)');
    console.log('  Total: 7 angle bracket uses');
    
    // Check what tokens were created
    console.log('\nTokenization of angle brackets:');
    tokens.forEach((token, i) => {
        if (token.value === '<' || token.value === '>' || token.value === '<-' || token.value === '->') {
            const context = tokens.slice(Math.max(0, i-2), Math.min(tokens.length, i+3))
                .map(t => t.value).join(' ');
            console.log(`  Token: "${token.value}" in context: ...${context}...`);
        }
    });
    
} catch (e) {
    console.log('PARSE ERROR:', e.message);
    console.log('\nThis means the test would pass (no error check)');
    console.log('but we don\'t know if parsing is correct!');
}

console.log('\n\nWHAT THE TEST SHOULD CHECK:');
console.log('----------------------------');
console.log(`
// Better test implementation:
test('parses mixed async/concurrent patterns', () => {
    const ast = parseCode(code);
    
    // Check function declaration
    const func = ast.body[0] as AST.FuncDecl;
    expect(func.kind).toBe('FuncDecl');
    expect(func.modifiers).toContain('async');
    
    // Check generics parsed correctly
    expect(func.genericParams).toHaveLength(1);
    expect(func.genericParams[0].name).toBe('T');
    
    // Check parameter type is generic
    const paramType = func.params[0].type as AST.GenericType;
    expect(paramType.kind).toBe('GenericType');
    expect(paramType.base.name).toBe('Stream');
    
    // Check return type is nested generic
    const returnType = func.returnType as AST.GenericType;
    expect(returnType.kind).toBe('GenericType');
    expect(returnType.base.name).toBe('Result');
    
    // Check for channel operations in body
    // Check for go routine
    // Check for select statement
    // etc...
});
`);