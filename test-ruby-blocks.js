const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

const tests = [
  'items.each { |x| puts x }',
  'items.each do |x| puts x end',
  'def render_list(items) end',
  `def render_list(items)
    items.each do |item|
      puts item
    end
  end`
];

tests.forEach(code => {
  console.log('\nTesting:', code.replace(/\n/g, '\\n'));
  
  const lexer = new Lexer(code);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens);
  
  try {
    const ast = parser.parse();
    console.log('  ✓ Parsed, body length:', ast.body.length);
    if (ast.body[0]) {
      console.log('  Kind:', ast.body[0].kind);
    }
  } catch (e) {
    console.log('  ✗ Error:', e.message);
  }
});
