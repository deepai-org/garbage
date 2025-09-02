const { quickTest, testVariations } = require('./debug-utils');

// Test different lambda patterns
function testLambdas() {
  console.log('\n🔍 Testing Lambda Patterns\n');
  
  testVariations('lambda', {
    'Single param': 'x => x + 1',
    'Single param with body': 'x => { return x + 1 }',
    'Multiple params': '(x, y) => x + y',
    'With types': '(x: number, y: number): number => x + y',
    'Async lambda': 'async () => await foo()',
    'Async single param': 'async x => await process(x)',
    'Nested lambdas': 'x => y => x + y',
    'IIFE': '(() => console.log("hi"))()',
    'Go style': 'go async () => { process() }',
  }, { showTokens: false });
}

// Test different for loop patterns
function testForLoops() {
  console.log('\n🔍 Testing For Loop Patterns\n');
  
  testVariations('for loops', {
    'C-style': 'for (let i = 0; i < 10; i++) { }',
    'Go-style': 'for i := 0; i < 10; i++ { }',
    'Foreach': 'for x in items { }',
    'For-of': 'for (const item of items) { }',
    'For-in': 'for (const key in obj) { }',
    'Infinite': 'for { break }',
    'While-style': 'for x < 10 { x++ }',
    'For-await': 'for await (const item of stream) { }',
  }, { showTokens: false });
}

// Test function declarations
function testFunctions() {
  console.log('\n🔍 Testing Function Patterns\n');
  
  testVariations('functions', {
    'Basic fn': 'fn test() {}',
    'With generics': 'fn test<T>() {}',
    'With params': 'fn test<T>(x: T) {}',
    'With return type': 'fn test<T>(x: T) -> T {}',
    'Arrow return': 'fn test<T>(x: T) => T {}',
    'Chained return': 'fn curry<A,B,C>(f: (A,B) -> C) -> A -> B -> C {}',
    'Async function': 'async fn test() {}',
    'Def style': 'def test(): pass',
    'Function keyword': 'function test() {}',
  }, { showTokens: false });
}

// Test specific problem patterns
function testProblems() {
  console.log('\n🔍 Testing Problem Patterns\n');
  
  testVariations('problems', {
    'make(chan)': 'ch := make(chan int)',
    'make with size': 'ch := make(chan int, 100)',
    'Channel receive': 'x := <-ch',
    'Channel send': 'ch <- value',
    'Select statement': 'select { case x := <-ch: process(x) }',
    'Match expression': 'match x { Some(v) => v, None => 0 }',
    'Pattern guards': 'match x { Some(v) if v > 0 => v }',
  }, { showTokens: false });
}

// Run all pattern tests
function testAll() {
  testLambdas();
  testForLoops();
  testFunctions();
  testProblems();
}

// Export for use
module.exports = {
  testLambdas,
  testForLoops,
  testFunctions,
  testProblems,
  testAll
};

// CLI
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.length === 0 || args[0] === 'all') {
    testAll();
  } else {
    switch(args[0]) {
      case 'lambda': testLambdas(); break;
      case 'for': testForLoops(); break;
      case 'function': testFunctions(); break;
      case 'problems': testProblems(); break;
      default: console.log('Unknown test group:', args[0]);
    }
  }
}