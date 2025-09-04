const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

// Test import with alias
const testCases = [
  'import "module" as mod;',
  'import "path/to/module" as myModule;',
  'import { foo } from "module";',
  'import * as ns from "module";',
  'import defaultExport from "module";'
];

for (const code of testCases) {
  console.log(`\nTesting: ${code}`);
  const lexer = new Lexer(code);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens);
  const ast = parser.parse();
  
  if (parser.errors.length > 0) {
    console.log('  Errors:', parser.errors.map(e => e.message).join(', '));
  } else {
    console.log('  Success!');
    const imp = ast.body[0];
    console.log('  Import:', {
      kind: imp.kind,
      path: imp.path,
      alias: imp.alias?.name,
      imports: imp.imports?.map(i => i.name)
    });
  }
}