const { Lexer } = require('../dist/lexer');
const { Parser } = require('../dist/parser');

const code = `fn orchestrate(tasks: []Task) {
  results := make(chan Result, len(tasks))
  errors := make(chan Error, 10)
  done := make(chan bool)
  
  for i := 0; i < runtime.NumCPU(); i++ {
    go func(workerId int) {
      for task := range tasks {
        select {
          case <-done:
            return
          default:
            try {
              result := await task.execute()
              results <- result
            } catch (e) {
              errors <- e
            }
        }
      }
    }(i)
  }
}`;

console.log('Testing orchestrate function...\n');

const lexer = new Lexer(code);
const tokens = lexer.tokenize();
const parser = new Parser(tokens);

try {
    const ast = parser.parse();
    console.log('Parsed successfully!');
    console.log('AST body length:', ast.body.length);
    
    // Count various elements
    let makeCount = 0;
    let goCount = 0;
    let selectCount = 0;
    let channelSends = 0;
    let channelReceives = 0;
    
    const analyze = (node) => {
        if (!node) return;
        
        if (node.kind === 'Call' && node.callee?.name === 'make') {
            makeCount++;
        }
        if (node.kind === 'Go') {
            goCount++;
        }
        if (node.kind === 'Switch' && node.discriminant?.name === '__select__') {
            selectCount++;
        }
        if (node.kind === 'Binary' && node.op === '<-') {
            channelSends++;
        }
        if (node.kind === 'Unary' && node.op === '<-') {
            channelReceives++;
        }
        
        for (const key in node) {
            const value = node[key];
            if (value && typeof value === 'object') {
                if (Array.isArray(value)) {
                    value.forEach(analyze);
                } else {
                    analyze(value);
                }
            }
        }
    };
    
    analyze(ast);
    
    console.log('\nCounts:');
    console.log('  make() calls:', makeCount);
    console.log('  go statements:', goCount);
    console.log('  select statements:', selectCount);
    console.log('  channel sends:', channelSends);
    console.log('  channel receives:', channelReceives);
} catch (e) {
    console.log('Parse error:', e.message);
}