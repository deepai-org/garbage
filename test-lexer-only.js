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
    throw new Error(\`Pipeline failed: \${e.message}\`)
  } finally {
    return {results, errors}
  }
}
`;

console.log('Testing lexer...');
console.time('Lexer time');

const timeout = setTimeout(() => {
  console.log('ERROR: Lexer exceeded 2 second timeout!');
  process.exit(1);
}, 2000);

try {
  const lexer = new Lexer(code);
  const tokens = lexer.tokenize();
  clearTimeout(timeout);
  console.timeEnd('Lexer time');
  
  console.log(`✅ Generated ${tokens.length} tokens`);
  
  // Show first and last few tokens
  console.log('\nFirst 10 non-whitespace tokens:');
  let shown = 0;
  for (const t of tokens) {
    if (t.type !== 'Whitespace' && shown < 10) {
      console.log(`  ${t.type}: "${t.value}"`);
      shown++;
    }
  }
  
} catch (e) {
  clearTimeout(timeout);
  console.log(`❌ Lexer error: ${e.message}`);
}