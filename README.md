# PolyScript

A universal parser that handles multiple programming language syntaxes in a single file. Every valid program in JavaScript, Python, TypeScript, Java, C#, C++, Go, PHP, Bash, or Ruby is valid PolyScript.

## Getting Started

```bash
npm install
npm run build
npm test
```

## Usage

### As a Library

```javascript
const { Lexer, Parser, Transpiler } = require('./dist');

const code = `
function greet(name: string): string {
    return "Hello, " + name
}
`;

const lexer = new Lexer(code);
const tokens = lexer.tokenize();
const parser = new Parser(tokens);
const ast = parser.parse();

// Transpile to JavaScript
const transpiler = new Transpiler();
const js = transpiler.transpile(ast);
```

### REPL

```bash
node repl.js
```

### Transpile a File

```bash
npm run transpile -- input.poly
```

## Architecture

```
src/
  ast.ts           - AST node type definitions (~836 lines)
  lexer.ts         - Tokenizer with 5 context modes (~1,237 lines)
  lexer-context.ts - Lexer mode stack management (~464 lines)
  parser.ts        - Multi-language parser (~8,769 lines)
  transpiler.ts    - JavaScript code generator (~1,107 lines)
  index.ts         - Public API exports
```

### Lexer Modes

The lexer switches between 5 modes to handle context-dependent tokenization:

1. **Normal** — default mode
2. **MemberAccess** — after `.`, keywords become identifiers
3. **BashCondition** — inside `[ ]` for bash tests
4. **Decorator** — after `@`, keywords become identifiers
5. **StringTemplate** — for special string literals

### Parser Highlights

- Multi-paradigm: classes, functions, pattern matching, decorators, generics
- JSX/TSX with generic type arguments (`<Table<RowData>>`)
- Type assertions vs JSX disambiguation
- Rust-style syntax (`::`, `async move`, `.await`, `?` try operator)
- Deep nested generics (15+ levels)
- Virtual semicolons for newline-sensitive languages
- Complete AST with no data loss for imports, exports, decorators, types, patterns, and class members

## Tests

```bash
npm test          # run all tests
npm run build     # build TypeScript
```

430 of 432 tests passing across 30 test suites. Full specification in [Spec.md](Spec.md).

## License

MIT
