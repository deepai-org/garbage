const { testVariations } = require('./debug-utils');

console.log('\n🔍 Testing Problem Patterns from Failing Tests\n');

testVariations('async patterns', {
  'Async block': 'async { await foo() }',
  'Standalone async': 'let x = async { return 1 }',
  'Async in expression': 'go async { process() }',
  'Try with colon': 'try: something()',
  'Try-except': 'try: something() except: pass',
  'Using without parens': 'using resource { }',
  'With statement': 'with context: pass',
  'Select statement': 'select { case x := <-ch: process(x) }',
  'Case in': 'case $x in 1) echo one ;; esac',
  'While-do': 'while true do echo hi done',
}, { showTokens: false });