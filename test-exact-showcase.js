const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

// Exact code from first showcase test
const code = `
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
    throw new Error("Pipeline failed: " + e.message)
  } finally {
    return {results, errors}
  }
}
`;

console.log('Testing exact showcase code...');
console.log('Code length:', code.length);

const startTime = Date.now();
const timeout = setTimeout(() => {
  const elapsed = Date.now() - startTime;
  console.log(`ERROR: Timeout after ${elapsed}ms!`);
  process.exit(1);
}, 5000);

try {
  const lexer = new Lexer(code);
  const tokens = lexer.tokenize();
  console.log('Tokens created:', tokens.length);
  
  const parser = new Parser(tokens);
  const ast = parser.parse();
  
  clearTimeout(timeout);
  const elapsed = Date.now() - startTime;
  
  console.log(`✅ Success in ${elapsed}ms! AST nodes: ${ast.body.length}`);
} catch (e) {
  clearTimeout(timeout);
  console.log(`❌ Error: ${e.message}`);
}