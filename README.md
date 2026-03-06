# PolyScript

A universal parser and compiler that handles multiple programming language syntaxes in a single file. Write JavaScript, Python, Go, TypeScript, Java, C#, C++, PHP, Bash, or Ruby — all in one `.poly` file — and compile to a dispatch manifest that [OmniVM](https://github.com/nicholasgasior/gogenern) executes across multiple runtimes.

## Getting Started

```bash
npm install
npm run build
npm test
```

## Usage

### Compile a .poly File

```bash
npm run polyc -- myapp.poly
```

This outputs a **dispatch manifest** — a JSON IR that OmniVM interprets, dispatching each code fragment to the appropriate runtime (Python, JavaScript, Go, etc.).

### Example: Three Languages in One File

```polyscript
// @runtime javascript

import express from "express"
const app = express()

// Python: text processing (stdlib only)
def slugify(text):
  import re
  text = text.lower().strip()
  text = re.sub(r"[^\w\s-]", "", text)
  return text

// Go: compute-intensive work
func hash_id(input) {
  h := input * 2654435761
  h = h ^ (h >> 16)
  return h
}

// JavaScript: Express routes orchestrate all runtimes
app.get("/api/slug/:text", async function(req, res) {
  const slug = slugify(req.params.text)
  res.json({ original: req.params.text, slug: slug })
})

app.get("/api/hash/:id", async function(req, res) {
  const hashed = hash_id(parseInt(req.params.id))
  res.json({ id: parseInt(req.params.id), hash: hashed })
})

app.listen(3000, function() {
  console.log("Polyglot server on :3000")
})
```

The compiler automatically:
- Detects which runtime each block belongs to (`def` → Python, `func` → Go, `function` → JS)
- Tracks data flow across runtimes via captures
- Hoists imports out of function bodies to top-level
- Reconstructs valid Go source with proper types (`interface{}` defaults, `.(int)` type assertions, `make(chan interface{}, N)`)
- Generates forward declarations and `Init()` injection points for external Go dependencies

### As a Library

```javascript
const { Lexer, Parser, RuntimeResolver, ManifestCodeGenerator } = require('./dist');

const code = `...`;
const lexer = new Lexer(code);
const tokens = lexer.tokenize();
const parser = new Parser(tokens, code);
const ast = parser.parse();

// Resolve runtimes and generate dispatch manifest
const resolver = new RuntimeResolver();
const annotated = resolver.resolve(ast, code);
const generator = new ManifestCodeGenerator();
const manifest = generator.generate(annotated);
```

### Legacy Transpiler

```bash
npm run transpile -- input.poly  # Transpile to JavaScript
node repl.js                     # REPL
```

## Architecture

```
src/
  ast.ts                          - AST node types
  lexer.ts                        - Tokenizer with 5 context modes
  parser.ts                       - Multi-language parser
  transpiler.ts                   - Legacy JavaScript transpiler

  runtime-resolver/               - Runtime affinity analysis
    pass1-structural.ts           - Keyword/import-based detection
    pass2-propagation.ts          - Data flow propagation
    cost-model.ts                 - Runtime cost scoring
    symbol-table.ts               - Cross-runtime binding tracker
    method-tables.ts              - Language-specific method signatures

  codegen-omnivm/                 - Dispatch manifest generator
    manifest-generator.ts         - AST → manifest ops
    manifest-types.ts             - Op type definitions
    source-reconstruct.ts         - AST → source code strings
    runtime-blocks.ts             - Runtime block consolidation

  cli-manifest.ts                 - CLI: polyc compiler
```

### Pipeline

```
Source (.poly) → Lexer → Parser → AST
  → Runtime Resolver (which runtime owns each node?)
  → Manifest Generator (emit dispatch ops with captures)
  → Dispatch Manifest (JSON IR for OmniVM)
```

### Dispatch Manifest Format

The manifest is a sequence of ops that OmniVM executes. No language is "on top" — OmniVM is the orchestrator.

| Op | Purpose |
|----|---------|
| `import` | Import a module in a runtime |
| `eval` | Execute code, bind result to a name |
| `exec` | Execute code, discard result |
| `func_def` | Define a callable function (possibly polyglot body) |
| `return` | Return from function |
| `declare` | Declare a manifest-scope literal |
| `if` / `loop` | Control flow |
| `concat` | Polyglot string interpolation |

Go functions emit a `source` field (complete compilation unit) with `exports` (PascalCase symbol names for `plugin.Lookup`) and `requires` (external dependencies injected via `Init()`).

### Parser Highlights

- Multi-paradigm: classes, functions, pattern matching, decorators, generics
- JSX/TSX with generic type arguments (`<Table<RowData>>`)
- Type assertions vs JSX disambiguation
- Rust-style syntax (`::`, `async move`, `.await`, `?` try operator)
- Deep nested generics (15+ levels)
- Virtual semicolons for newline-sensitive languages
- Runtime tag expressions (`@py(expr)`, `@go(expr)`)
- Complete AST with no data loss

601 tests passing across 33 test suites. Full specification in [Spec.md](Spec.md).

## License

MIT
