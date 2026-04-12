# PolyScript

A universal parser that handles multiple programming language syntaxes in a single file. Write Python, JavaScript, Go, Rust, Ruby, Bash, and more — all in the same `.poly` file — and PolyScript will parse, resolve runtimes, and generate a dispatch manifest that orchestrates execution across language boundaries.

## Why?

Modern backends glue together multiple runtimes anyway — Python for ML, Go for concurrency, JS for APIs. PolyScript makes that explicit at the syntax level. Instead of shelling out or using FFI, you write naturally in each language and let the compiler figure out the bridging.

```polyscript
import os
import json

// Python: scan the filesystem
const files = os.listdir("/var/data")

// JS: arrow function forces this to JavaScript
const loud = files.map(f => f.toUpperCase())

// Python: list comprehension stays in Python
const filtered = [f for f in loud if f.endswith(".log")]

// Go: spin up concurrent workers
go worker(1)
go worker(2)

print(f"Found {len(filtered)} log files")
```

## Getting Started

```bash
npm install
npm test          # Run all 850 tests
npm run build     # Compile TypeScript
```

### Compile a .poly File

```bash
npm run polyc -- myapp.poly
```

This outputs a **dispatch manifest** — a JSON IR that OmniVM interprets, dispatching each code fragment to the appropriate runtime.

### As a Library

```javascript
const { Lexer, Parser, RuntimeResolver, ManifestCodeGenerator } = require('./dist');

const code = `...`;
const lexer = new Lexer(code);
const tokens = lexer.tokenize();
const parser = new Parser(tokens, code);
const ast = parser.parse();

const resolver = new RuntimeResolver();
const annotated = resolver.resolve(ast, code);
const generator = new ManifestCodeGenerator();
const manifest = generator.generate(annotated);
```

## How It Works

```
Source (.poly) → Lexer → Parser → AST
  → Runtime Resolver (which runtime owns each node?)
  → Manifest Generator (emit dispatch ops with captures)
  → Dispatch Manifest (JSON IR for OmniVM)
```

1. **Lexer** — Tokenizes polyglot source with virtual semicolon insertion (MASI), 5 context modes, and operator ambiguity handling (`<` as comparison vs generic vs JSX)
2. **Parser** — Pratt parser with parselet registry producing a unified AST from mixed syntax
3. **Runtime Resolver** — Two-pass analysis determines which language each expression belongs to using import provenance, syntactic dominance (arrows → JS, list comprehensions → Python), and cost modeling
4. **Manifest Generator** — Emits a dispatch manifest that tells OmniVM how to orchestrate calls across runtimes with automatic bridging

## Supported Syntax

PolyScript parses real syntax from each donor language — nothing is invented.

| Language   | Features                                                                 |
|------------|--------------------------------------------------------------------------|
| JavaScript | Arrow functions, async/await, destructuring, template literals, JSX, `===` |
| TypeScript | Type annotations, generics, interfaces, mapped types, type assertions    |
| Python     | List comprehensions, `def`, `for...in`, f-strings, decorators, `from...import` |
| Go         | Short declarations `:=`, goroutines, channels `<-`, `select`, `func`, composite literals |
| Rust       | `fn`, `match`, `::` paths, `.await`, `?` operator, macro patterns, traits |
| Ruby       | `do...end` blocks, `\|params\|`, `unless`, symbols                       |
| Bash       | `if...then...fi`, `case...esac`, `[ ]` tests                            |
| C++        | Templates, concepts, `requires` expressions, `::` scope resolution       |
| Kotlin     | `when` expressions, `fun`                                                |
| Swift      | `guard`, operator declarations                                           |
| Elixir     | Pipe operator `\|>`, `defmacro`, `do...end`                              |

## Dispatch Manifest

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

## Project Structure

```
src/
  lexer.ts                # Main scanner
  lexer-*.ts              # 6 lexer modules (operators, literals, identifiers, comments, MASI, cursor)
  parser.ts               # Pratt parser dispatch (~925 lines)
  parser-cursor.ts        # Transactional cursor base
  parselet-registry.ts    # Keyword → parselet dispatch table
  parselets/              # 11 parselet modules
    jsx.ts                #   JSX/TSX elements
    types.ts              #   Type annotations and generics
    functions.ts          #   Function declarations, parameters, lambdas
    control-flow.ts       #   if/for/while/try/do/defer/go
    blocks.ts             #   Block parsing, switch/match, case...esac
    declarations.ts       #   const/let/var/type/export
    imports.ts            #   import/require/from...import/using
    class-decl.ts         #   Classes, interfaces, traits, enums
    expr-prefix.ts        #   Primary expressions, unary ops, literals
    expr-postfix.ts       #   Calls, member access, Ruby blocks
    literals.ts           #   Strings, arrays, objects, regex
  ast.ts                  # Unified AST node types
  runtime-resolver/       # Two-pass runtime affinity analysis
  codegen-omnivm/         # Dispatch manifest + source reconstruction
test/                     # 850 tests across 36 suites
examples/                 # Polyglot example files
```

## Examples

See [`examples/`](examples/) for complete polyglot programs:

- **cursed-polyglot.poly** — Python/JS pipeline that ping-pongs between runtimes every line
- **cursed-concurrency.poly** — Python generators + Go channels + JS async all talking to each other
- **syntactic-dominance.poly** — Demonstrates how arrow functions override import provenance

## License

MIT
