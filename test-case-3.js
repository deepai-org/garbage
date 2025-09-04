
const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

const code = `
# Task orchestrator with Go channels and JavaScript promises
fn orchestrate(tasks: []Task) {
  # Create channels for communication
  results := make(chan Result, len(tasks))
  errors := make(chan Error, len(tasks))
  done := make(chan bool)
  
  # Launch workers
  for i := 0; i < 10; i++ {
    go func(id) {
      for task := range tasks {
        try {
          result := await task.execute()
          results <- result
        } catch (e) {
          errors <- e
        }
      }
      done <- true
    }(i)
  }
  
  # Collect results with timeout
  collected := []
  errorList := []
  timeout := setTimeout(() => {
    throw new Error("Timeout")
  }, 30000)
  
  loop {
    select {
      case result := <-results:
        collected.push(result)
        if len(collected) == len(tasks) {
          clearTimeout(timeout)
          break
        }
      case err := <-errors:
        errorList.push(err)
      case <-done:
        workers--
        if workers == 0 {
          break
        }
    }
  }
  
  return {
    successful: collected,
    failed: errorList
  }
}
`;

console.log('Testing: parses concurrent task orchestrator');
console.log('Code length:', code.length);

const timeout = setTimeout(() => {
  console.log('TIMEOUT - Parser stuck!');
  process.exit(1);
}, 2000);

try {
  const lexer = new Lexer(code);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens);
  const ast = parser.parse();
  clearTimeout(timeout);
  
  console.log(`Success! AST body length: ${ast.body.length}`);
} catch (e) {
  clearTimeout(timeout);
  console.log('Parse error:', e.message);
}
