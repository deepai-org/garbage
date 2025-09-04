const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

// Test 1: The problematic async data processor
const code1 = `
# Real-world data processing pipeline mixing paradigms
async function processDataStream(source: DataSource) {
  results := []
  errors := []
  
  try {
    # Python-style with statement for resource management
    with source.connect() as conn:
      # Go-style defer for cleanup
      defer conn.close()
      
      # Bash-style loop with mixed syntax
      while [ $retries -lt 3 ]; do
        try:
          # Async iteration
          data := await conn.fetch()
          
          # Ruby-style block processing
          begin
            processed := data
              |> validate
              |> transform
              |> enrich
            
            # Pattern matching for result handling
            match processed {
              {status: "success", value} => results.push(value),
              {status: "error", reason} => errors.push(reason),
              _ => console.warn("Unknown result")
            }
          rescue ProcessingError => e
            errors.push(e.message)
            retry if retries < 3
          end
          
          retries := 0  # Reset on success
        except TimeoutError:
          retries++
          await sleep(1000)
        finally:
          log("Attempt completed")
      done
  } catch (e) {
    throw new Error(\`Pipeline failed: \${e.message}\`)
  } finally {
    return {results, errors}
  }
}
`;

console.log('Testing showcase case 1...');

try {
  console.time('Parse time');
  const lexer = new Lexer(code1);
  const tokens = lexer.tokenize();
  
  // Set a hard timeout
  const timeout = setTimeout(() => {
    console.log('ERROR: Parser exceeded 5 second timeout!');
    console.log('Parser likely stuck in infinite loop');
    process.exit(1);
  }, 5000);
  
  const parser = new Parser(tokens);
  const ast = parser.parse();
  
  clearTimeout(timeout);
  console.timeEnd('Parse time');
  
  console.log(`✅ Success! AST nodes: ${ast.body.length}`);
  
  if (ast.body.length > 0) {
    const func = ast.body[0];
    console.log(`   First node type: ${func.kind}`);
    if (func.kind === 'FuncDecl') {
      console.log(`   Function name: ${func.name.name}`);
      console.log(`   Is async: ${func.async}`);
    }
  }
} catch (e) {
  console.log(`❌ Parse error: ${e.message}`);
  console.log(`   Stack: ${e.stack?.split('\n')[1]}`);
}