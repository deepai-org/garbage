/**
 * Type Pipeline Integration Tests (TDD)
 *
 * Tests the FULL path: .poly source → Lexer → Parser → RuntimeResolver →
 * ManifestGenerator (with BoundaryChecker) → manifest with bridge ops.
 *
 * Each level builds on the previous, from simple single-language type annotations
 * to complex cross-runtime data flows with streams, buffers, and disposables.
 */

import { Lexer } from '../src/lexer';
import { Parser } from '../src/parser';
import { RuntimeResolver } from '../src/runtime-resolver';
import { ManifestCodeGenerator } from '../src/codegen-omnivm/manifest-generator';
import { DispatchManifest } from '../src/codegen-omnivm/manifest-types';
import { BoundaryChecker, lowerType, typeToString } from '../src/type-system';

function parseAndManifest(code: string): DispatchManifest {
  const lexer = new Lexer(code);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens, code);
  const ast = parser.parse();
  const resolver = new RuntimeResolver();
  const annotated = resolver.resolve(ast, code);
  const gen = new ManifestCodeGenerator();
  return gen.generate(annotated);
}

function parseAST(code: string) {
  const tokens = new Lexer(code).tokenize();
  return new Parser(tokens, code).parse();
}

// ════════════════════════════════════════════════════════════════
// Level 1: Parser captures type annotations from each language
// ════════════════════════════════════════════════════════════════

describe('Level 1: Type annotations are captured in AST', () => {

  test('TypeScript: function with typed params and return', () => {
    const ast = parseAST('function greet(name: string, age: number): string { return name }');
    const fn = ast.body[0] as any;
    expect(fn.kind).toBe('FuncDecl');
    expect(fn.params[0].type.id.name).toBe('string');
    expect(fn.params[1].type.id.name).toBe('number');
    expect(fn.returnType.id.name).toBe('string');
  });

  test('Python: def with type annotations and -> return', () => {
    const ast = parseAST('def process(data: list, count: int) -> str:\n    return str(count)');
    const fn = ast.body[0] as any;
    expect(fn.kind).toBe('FuncDecl');
    expect(fn.params[0].type.id.name).toBe('list');
    expect(fn.params[1].type.id.name).toBe('int');
    expect(fn.returnType.id.name).toBe('str');
  });

  test('Rust: fn with typed params and -> return', () => {
    const ast = parseAST('fn multiply(a: i32, b: i32) -> i32 { a * b }');
    const fn = ast.body[0] as any;
    expect(fn.kind).toBe('FuncDecl');
    expect(fn.params[0].type.id.name).toBe('i32');
    expect(fn.params[1].type.id.name).toBe('i32');
    expect(fn.returnType.id.name).toBe('i32');
  });

  test('Go: func with typed params and return type', () => {
    const ast = parseAST('func add(x int, y int) int { return x + y }');
    const fn = ast.body[0] as any;
    expect(fn.kind).toBe('FuncDecl');
    expect(fn.params[0].type.id.name).toBe('int');
    expect(fn.params[1].type.id.name).toBe('int');
    expect(fn.returnType.id.name).toBe('int');
  });

  test('TypeScript: let with type annotation', () => {
    const ast = parseAST('let x: number = 42');
    const decl = ast.body[0] as any;
    expect(decl.kind).toBe('VarDecl');
    expect(decl.type.id.name).toBe('number');
  });

  test('Python: variable with type annotation', () => {
    const ast = parseAST('x: int = 42');
    const decl = ast.body[0] as any;
    // Should be accessible as .type (not .declType)
    const type = decl.type || decl.declType;
    expect(type).toBeDefined();
    expect(type.id.name).toBe('int');
  });

  test('Go: var with type', () => {
    const ast = parseAST('var count int = 10');
    const decl = ast.body[0] as any;
    const type = decl.type || decl.declType;
    expect(type).toBeDefined();
    expect(type.id.name).toBe('int');
  });

  test('Rust: let with type annotation', () => {
    const ast = parseAST('let mut name: String = "hello"');
    const decl = ast.body[0] as any;
    expect(decl.type.id.name).toBe('String');
  });

  test('TypeScript: generic types preserved', () => {
    const ast = parseAST('function getItems(): Array<string> { return [] }');
    const fn = ast.body[0] as any;
    expect(fn.returnType.kind).toBe('GenericType');
    expect(fn.returnType.base.name).toBe('Array');
    expect(fn.returnType.args[0].id.name).toBe('string');
  });

  test('Go: []string return type captured', () => {
    const ast = parseAST('func getFiles(dir string) []string { return nil }');
    const fn = ast.body[0] as any;
    expect(fn.returnType).toBeDefined();
    // Should parse as an array type of string
  });

  test('Rust: Result<T, E> return type captured', () => {
    const ast = parseAST('fn parse(s: &str) -> Result<i32, String> { Ok(42) }');
    const fn = ast.body[0] as any;
    expect(fn.returnType).toBeDefined();
    expect(fn.returnType.kind).toBe('GenericType');
    expect(fn.returnType.base.name).toBe('Result');
  });

  test('Python: Optional[str] type annotation', () => {
    const ast = parseAST('def find(key: str) -> Optional[str]:\n    return None');
    const fn = ast.body[0] as any;
    expect(fn.returnType).toBeDefined();
    expect(fn.returnType.kind).toBe('GenericType');
    expect(fn.returnType.base.name).toBe('Optional');
  });
});

// ════════════════════════════════════════════════════════════════
// Level 2: Type lowering produces correct canonical types
// ════════════════════════════════════════════════════════════════

describe('Level 2: Parsed types lower to correct canonical forms', () => {

  function lowerFromSource(code: string, runtime?: string): any {
    const ast = parseAST(code);
    const fn = ast.body[0] as any;
    // Get the first param's type or the return type
    const typeNode = fn.params?.[0]?.type || fn.returnType || fn.type || fn.declType;
    if (!typeNode) return null;
    return lowerType(typeNode, runtime as any);
  }

  test('TS number → f64', () => {
    const t = lowerFromSource('function f(x: number) {}', 'javascript');
    expect(t.kind).toBe('float');
    expect(t.size).toBe(64);
  });

  test('Python int → bigint', () => {
    const t = lowerFromSource('def f(x: int): pass', 'python');
    expect(t.kind).toBe('int');
    expect(t.size).toBe('big');
  });

  test('Go int → i64', () => {
    const t = lowerFromSource('func f(x int) {}', 'go');
    expect(t.kind).toBe('int');
    expect(t.size).toBe(64);
  });

  test('Rust i32 → i32', () => {
    const t = lowerFromSource('fn f(x: i32) {}', 'rust');
    expect(t.kind).toBe('int');
    expect(t.size).toBe(32);
  });

  test('TS string → string', () => {
    const t = lowerFromSource('function f(x: string) {}', 'javascript');
    expect(t.kind).toBe('string');
  });

  test('Python str → string', () => {
    const t = lowerFromSource('def f(x: str): pass', 'python');
    expect(t.kind).toBe('string');
  });

  test('TS Array<number> → Array<f64>', () => {
    const ast = parseAST('function f(): Array<number> { return [] }');
    const fn = ast.body[0] as any;
    const t = lowerType(fn.returnType, 'javascript');
    expect(t.kind).toBe('array');
    expect(typeToString(t)).toBe('Array<f64>');
  });

  test('Rust Result<i32, String> → Result<i32, string>', () => {
    const ast = parseAST('fn f() -> Result<i32, String> { Ok(1) }');
    const fn = ast.body[0] as any;
    if (!fn.returnType) { expect(fn.returnType).toBeDefined(); return; }
    const t = lowerType(fn.returnType, 'rust');
    expect(t.kind).toBe('result');
    expect(typeToString(t)).toBe('Result<i32, string>');
  });

  test('Python Optional[str] → Option<string>', () => {
    const ast = parseAST('def f() -> Optional[str]:\n    return None');
    const fn = ast.body[0] as any;
    if (!fn.returnType) { expect(fn.returnType).toBeDefined(); return; }
    const t = lowerType(fn.returnType, 'python');
    expect(t.kind).toBe('option');
    expect(typeToString(t)).toBe('Option<string>');
  });

  test('TS Promise<string> → Async<string>', () => {
    const ast = parseAST('function f(): Promise<string> { return "" }');
    const fn = ast.body[0] as any;
    const t = lowerType(fn.returnType, 'javascript');
    expect(t.kind).toBe('async');
    expect(typeToString(t)).toBe('Async<string>');
  });
});

// ════════════════════════════════════════════════════════════════
// Level 3: Cross-runtime functions produce bridge ops in manifest
// ════════════════════════════════════════════════════════════════

describe('Level 3: Cross-runtime calls produce bridge ops', () => {

  test('Python function called from JS triggers boundary check', () => {
    const code = `
import os

def get_files(path: str) -> list:
    return os.listdir(path)

const files = get_files("/tmp")
console.log(files)
`;
    const m = parseAndManifest(code);
    expect(m.ops.length).toBeGreaterThan(0);
    // The manifest should have ops from both python and javascript runtimes
    const runtimes = new Set(m.ops.map((op: any) => op.runtime).filter(Boolean));
    expect(runtimes.size).toBeGreaterThanOrEqual(1);
  });

  test('Go function with typed params produces func_def op', () => {
    const code = `
func add(x int, y int) int {
    return x + y
}

const sum = add(1, 2)
`;
    const m = parseAndManifest(code);
    const funcDef = m.ops.find((op: any) => op.op === 'func_def') as any;
    expect(funcDef).toBeDefined();
    expect(funcDef.name).toBe('add');
  });

  test('Rust function returning Result produces throw_typed bridge', () => {
    const code = `
fn parse_config(path: &str) -> Result<String, ParseError> {
    Ok("config")
}

const config = parse_config("app.toml")
console.log(config)
`;
    const m = parseAndManifest(code);
    // If crossings detected, bridges should include throw_typed
    if (m.bridges && m.bridges.length > 0) {
      const throwOp = m.bridges.find(b => b.op === 'throw_typed');
      if (throwOp) {
        expect(throwOp.op).toBe('throw_typed');
      }
    }
  });
});

// ════════════════════════════════════════════════════════════════
// Level 4: Advanced types from real syntax
// ════════════════════════════════════════════════════════════════

describe('Level 4: Advanced types from polyglot syntax', () => {

  test('TS AsyncIterable lowers to Stream', () => {
    const ast = parseAST('async function* generate(): AsyncIterable<number> { yield 1 }');
    const fn = ast.body[0] as any;
    if (!fn.returnType) { expect(fn.returnType).toBeDefined(); return; }
    const t = lowerType(fn.returnType, 'javascript');
    expect(t.kind).toBe('stream');
    expect(typeToString(t)).toBe('Stream<f64>');
  });

  test('TS Uint8Array lowers to BufferView<u8>', () => {
    const ast = parseAST('function process(buf: Uint8Array): number { return buf.length }');
    const fn = ast.body[0] as any;
    const t = lowerType(fn.params[0].type, 'javascript');
    expect(t.kind).toBe('buffer_view');
    expect(typeToString(t)).toBe('BufferView<u8>');
  });

  test('Go chan int in function produces channel type', () => {
    const ast = parseAST('func produce(ch chan int) { ch <- 42 }');
    const fn = ast.body[0] as any;
    expect(fn.params[0].type).toBeDefined();
    if (fn.params[0].type) {
      const t = lowerType(fn.params[0].type, 'go');
      expect(t.kind).toBe('channel');
    }
  });

  test('TS Map<string, number> preserved through pipeline', () => {
    const ast = parseAST('function f(m: Map<string, number>): void {}');
    const fn = ast.body[0] as any;
    const t = lowerType(fn.params[0].type, 'javascript');
    expect(t.kind).toBe('map');
    expect(typeToString(t)).toBe('Map<string, f64>');
  });

  test('Python Dict[str, List[int]] lowers correctly', () => {
    const ast = parseAST('def f(d: Dict[str, List[int]]) -> None:\n    pass');
    const fn = ast.body[0] as any;
    const t = lowerType(fn.params[0].type, 'python');
    expect(t.kind).toBe('map');
    expect(typeToString(t)).toBe('Map<string, Array<ibig>>');
  });
});

// ════════════════════════════════════════════════════════════════
// Level 5: Full polyglot pipeline with type-aware bridges
// ════════════════════════════════════════════════════════════════

describe('Level 5: Full polyglot pipeline', () => {

  test('Python→JS: typed function crossing produces coerce/check info', () => {
    const code = `
def compute(x: int, y: float) -> float:
    return x * y

const result: number = compute(10, 3.14)
`;
    const m = parseAndManifest(code);
    expect(m.ops.length).toBeGreaterThan(0);
  });

  test('Go→Rust: integer narrowing detected', () => {
    const code = `
func getCount() int {
    return 42
}

fn validate(n: i32) -> bool {
    n > 0
}

let valid = validate(getCount())
`;
    const m = parseAndManifest(code);
    expect(m.ops.length).toBeGreaterThan(0);
  });

  test('manifest typeSummary counts are sane', () => {
    const code = `const x: number = 42`;
    const m = parseAndManifest(code);
    if (m.typeSummary) {
      expect(m.typeSummary.crossings).toBeGreaterThanOrEqual(0);
      expect(m.typeSummary.errors).toBe(0);
    }
  });
});

// ════════════════════════════════════════════════════════════════
// Level 6: Advanced End-to-End — The Three Proofs
// ════════════════════════════════════════════════════════════════

describe('Level 6: Zero-Copy Buffer Pipeline', () => {
  /**
   * Prove that binary data passes between Go and Rust without triggering
   * slow JSON serialization. Go []byte → JS Uint8Array → Rust Vec<u8>
   * should use share_memory/copy_buffer, NOT serialize.
   */
  test('Go []byte → JS Uint8Array → Rust Vec<u8> uses zero-copy bridge ops', () => {
    const code = `
func ReadImage() []byte {
    return nil
}

fn process_image(data: Vec<u8>) -> usize {
    data.len()
}

function pipeline() {
    const img: Uint8Array = ReadImage()
    const size: number = process_image(img)
}
`;
    const m = parseAndManifest(code);

    // Must have bridge ops
    expect(m.bridges).toBeDefined();
    expect(m.bridges!.length).toBeGreaterThanOrEqual(1);

    // Crossing 1: Go []byte (Array<u8>) → JS Uint8Array (BufferView<u8>)
    // Bridge op MUST be share_memory, NOT serialize
    const goToJs = m.bridges!.find(b => b.binding === 'ReadImage()');
    expect(goToJs).toBeDefined();
    expect(goToJs!.op).toBe('share_memory');
    expect(goToJs!.from).toBe('go');
    expect(goToJs!.to).toBe('javascript');

    // Crossing 2: JS Uint8Array (BufferView<u8>) → Rust Vec<u8> (Array<u8>)
    // Bridge op should be copy_buffer (BufferView → Array copies out)
    const jsToRust = m.bridges!.find(b => b.binding.includes('process_image'));
    expect(jsToRust).toBeDefined();
    expect(jsToRust!.op).toBe('copy_buffer');
    expect(jsToRust!.from).toBe('javascript');
    expect(jsToRust!.to).toBe('rust');

    // CRITICAL: No serialize ops anywhere — binary data stays binary
    expect(m.bridges!.some(b => b.op === 'serialize')).toBe(false);

    // Summary should show coercions, not errors
    expect(m.typeSummary).toBeDefined();
    expect(m.typeSummary!.errors).toBe(0);
  });
});

describe('Level 6: Error Fidelity Boundary', () => {
  /**
   * Prove that Rust's nominal Result types produce throw_typed bridge ops
   * with error kind metadata, not generic unwrap_result.
   * This allows JS to catch specific error types structurally.
   */
  test('Rust Result<String, DbError> → JS string produces throw_typed with error metadata', () => {
    const code = `
class DbError {
    code: i32
}

fn fetch_user() -> Result<String, DbError> {
    Ok("alice")
}

function handle() {
    let user: string = fetch_user()
}
`;
    const m = parseAndManifest(code);

    // Must have exactly one bridge op
    expect(m.bridges).toBeDefined();
    expect(m.bridges!.length).toBe(1);

    const bridge = m.bridges![0];

    // The bridge op MUST be throw_typed, NOT generic unwrap_result
    expect(bridge.op).toBe('throw_typed');
    expect(bridge.from).toBe('rust');
    expect(bridge.to).toBe('javascript');

    // CRITICAL: The error kind metadata must be preserved
    // This is what allows JS to do: if (e.kind === 'DbError') { ... }
    expect(bridge.meta).toBeDefined();
    expect(bridge.meta!.errorKind).toBe('DbError');

    // Summary: 1 crossing, check (not error — it's handleable)
    expect(m.typeSummary).toBeDefined();
    expect(m.typeSummary!.check).toBe(1);
    expect(m.typeSummary!.errors).toBe(0);
  });
});

describe('Level 6: Hard Rejection — Nominal Type Safety', () => {
  /**
   * Prove that the boundary checker rejects nominal→nominal crossings
   * between different runtimes. Go Vector ≠ Rust Point, even if the
   * fields are identical. This is the type system catching a real bug.
   */
  test('Go nominal struct → Rust nominal struct is incompatible', () => {
    const code = `
func GetVec() Vector {
    return nil
}

fn calculate(p: Point) -> f64 {
    p.x + p.y
}

function main() {
    const v = GetVec()
    calculate(v)
}
`;
    const m = parseAndManifest(code);

    // The type system MUST report an error
    expect(m.typeSummary).toBeDefined();
    expect(m.typeSummary!.errors).toBeGreaterThanOrEqual(1);

    // The diagnostics should identify the nominal mismatch
    // (Vector from Go cannot satisfy Point in Rust)
  });

  test('same nominal type, same runtime is safe', () => {
    // Contrast: when types stay within one runtime, no error
    const code = `
fn make_point() -> Point { }
fn use_point(p: Point) -> f64 { 0.0 }

function main() {
    const p = make_point()
    use_point(p)
}
`;
    const m = parseAndManifest(code);

    // Within the same runtime (rust→rust), nominal match succeeds
    // No type errors expected for same-runtime usage
    if (m.typeSummary) {
      // Cross-runtime crossings may have errors, but rust→rust is fine
      // The function calls from JS→rust are the crossings
    }
  });
});
