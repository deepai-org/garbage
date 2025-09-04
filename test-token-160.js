const { Lexer } = require('./dist/lexer');

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

const lexer = new Lexer(code);
const tokens = lexer.tokenize();

// Filter out whitespace for cleaner view
const nonWs = tokens.filter(t => t.type !== 'Whitespace');

console.log('Tokens around position 160:');
console.log('Position 158:', nonWs[158]);
console.log('Position 159:', nonWs[159]);
console.log('Position 160:', nonWs[160]);
console.log('Position 161:', nonWs[161]);
console.log('Position 162:', nonWs[162]);