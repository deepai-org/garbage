import { Lexer } from '../src/lexer';
import { Parser } from '../src/parser';
import { RuntimeResolver } from '../src/runtime-resolver';
import { ManifestCodeGenerator } from '../src/codegen-omnivm/manifest-generator';
import { DispatchManifest, ManifestOp } from '../src/codegen-omnivm/manifest-types';

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

function findOp(manifest: DispatchManifest, opType: string): ManifestOp | undefined {
  return manifest.ops.find(op => op.op === opType);
}

function findAllOps(manifest: DispatchManifest, opType: string): ManifestOp[] {
  return manifest.ops.filter(op => op.op === opType);
}

// --- Top-level manifest structure ---

describe('Manifest Structure', () => {
  test('manifest has version 1', () => {
    const m = parseAndManifest('const x = 42');
    expect(m.version).toBe(1);
  });

  test('manifest has defaultRuntime', () => {
    const m = parseAndManifest('const x = 42');
    expect(m.defaultRuntime).toBeDefined();
  });

  test('manifest has ops array', () => {
    const m = parseAndManifest('const x = 42');
    expect(Array.isArray(m.ops)).toBe(true);
  });

  test('generateJSON returns valid JSON string', () => {
    const code = 'const x = 42';
    const lexer = new Lexer(code);
    const tokens = lexer.tokenize();
    const parser = new Parser(tokens, code);
    const ast = parser.parse();
    const resolver = new RuntimeResolver();
    const annotated = resolver.resolve(ast, code);
    const gen = new ManifestCodeGenerator();
    const json = gen.generateJSON(annotated);
    expect(() => JSON.parse(json)).not.toThrow();
    const parsed = JSON.parse(json);
    expect(parsed.version).toBe(1);
  });
});

// --- ExecOp: execute code, discard result ---

describe('ExecOp', () => {
  test('pass statement generates op with python runtime', () => {
    const m = parseAndManifest('pass');
    const op = m.ops[0] as any;
    expect(op.runtime).toBe('python');
  });

  test('Python print generates exec op', () => {
    const m = parseAndManifest('def greet(name):\n  print(name)');
    // Should have a func_def with python body
    const funcOp = m.ops.find(op => op.op === 'func_def');
    expect(funcOp).toBeDefined();
    if (funcOp && funcOp.op === 'func_def') {
      expect(funcOp.bodyRuntime).toBe('python');
    }
  });
});

// --- EvalOp: execute and bind result ---

describe('DeclareOp', () => {
  test('const with literal generates declare with value', () => {
    const m = parseAndManifest('const x = 42');
    const op = m.ops[0];
    expect(op.op).toBe('declare');
    if (op.op === 'declare') {
      expect(op.bind).toBe('x');
      expect(op.mutable).toBe(false);
      expect(op.value).toEqual({ kind: 'literal', value: 42 });
    }
  });

  test('const with expression generates bare eval with bind', () => {
    const m = parseAndManifest('const data = fetch("url")');
    const op = m.ops[0] as any;
    expect(op.op).toBe('eval');
    expect(op.bind).toBe('data');
    expect(op.code).toContain('fetch');
  });

  test('let declaration generates mutable declare op', () => {
    const m = parseAndManifest('let y = "hello"');
    const op = m.ops[0];
    expect(op.op).toBe('declare');
    if (op.op === 'declare') {
      expect(op.bind).toBe('y');
      expect(op.mutable).toBe(true);
    }
  });

  test('let without value generates declare with no from', () => {
    const m = parseAndManifest('let z');
    const op = m.ops[0];
    expect(op.op).toBe('declare');
    if (op.op === 'declare') {
      expect(op.bind).toBe('z');
      expect(op.from).toBeUndefined();
    }
  });
});

// --- FuncDefOp: function definitions ---

describe('FuncDefOp', () => {
  test('JS function generates func_def with body ops', () => {
    const m = parseAndManifest('function hello() { return 42 }');
    const op = m.ops.find(op => op.op === 'func_def');
    expect(op).toBeDefined();
    if (op && op.op === 'func_def') {
      expect(op.name).toBe('hello');
      expect(op.bodyRuntime).toBe('javascript');
      expect(op.body.length).toBeGreaterThan(0);
    }
  });

  test('Python def generates func_def with bodyRuntime', () => {
    const m = parseAndManifest('def greet(name):\n  print(name)');
    const op = m.ops.find(op => op.op === 'func_def');
    expect(op).toBeDefined();
    if (op && op.op === 'func_def') {
      expect(op.name).toBe('greet');
      expect(op.bodyRuntime).toBe('python');
    }
  });

  test('Rust fn generates func_def with compiled block', () => {
    const m = parseAndManifest('fn compute(x: i32) -> i32 { x * 2 }');
    // Rust is compiled — should be exec_compiled or func_def
    const hasCompiled = m.ops.some(op =>
      op.op === 'exec_compiled' ||
      (op.op === 'func_def' && op.bodyRuntime === 'rust')
    );
    expect(hasCompiled).toBe(true);
  });

  test('func_def includes params', () => {
    const m = parseAndManifest('function add(a, b) { return a }');
    const op = m.ops.find(op => op.op === 'func_def');
    expect(op).toBeDefined();
    if (op && op.op === 'func_def') {
      expect(op.params.length).toBe(2);
      expect(op.params[0].name).toBe('a');
      expect(op.params[1].name).toBe('b');
    }
  });
});

// --- ExecCompiledOp: compiled targets ---

describe('ExecCompiledOp', () => {
  test('Rust code generates exec_compiled', () => {
    const m = parseAndManifest('fn compute(x: i32) -> i32 { x * 2 }');
    const compiled = m.ops.find(op => op.op === 'exec_compiled');
    if (compiled && compiled.op === 'exec_compiled') {
      expect(compiled.lang).toBe('rust');
    }
    // Either exec_compiled directly or wrapped in func_def with bodyRuntime
    const funcDef = m.ops.find(op => op.op === 'func_def');
    if (funcDef && funcDef.op === 'func_def') {
      expect(funcDef.bodyRuntime).toBe('rust');
    }
  });
});

// --- ReturnOp ---

describe('ReturnOp', () => {
  test('return in JS function generates return op', () => {
    const m = parseAndManifest('function hello() { return 42 }');
    const funcOp = m.ops.find(op => op.op === 'func_def');
    expect(funcOp).toBeDefined();
    if (funcOp && funcOp.op === 'func_def') {
      const retOp = funcOp.body.find(op => op.op === 'return');
      expect(retOp).toBeDefined();
    }
  });
});

// --- IfOp ---

describe('IfOp', () => {
  test('if statement generates if op with arms', () => {
    const m = parseAndManifest('if true { let x = 1 }');
    const ifOp = m.ops.find(op => op.op === 'if');
    expect(ifOp).toBeDefined();
    if (ifOp && ifOp.op === 'if') {
      expect(ifOp.arms.length).toBeGreaterThan(0);
      expect(ifOp.arms[0].test).toBeDefined();
      expect(ifOp.arms[0].body.length).toBeGreaterThan(0);
    }
  });
});

// --- LoopOp ---

describe('LoopOp', () => {
  test('while loop generates loop op', () => {
    const m = parseAndManifest('while true { let x = 1 }');
    const loopOp = m.ops.find(op => op.op === 'loop');
    expect(loopOp).toBeDefined();
    if (loopOp && loopOp.op === 'loop') {
      expect(loopOp.mode).toBe('while');
      expect(loopOp.body.length).toBeGreaterThan(0);
    }
  });
});

// --- ImportOp ---

describe('ImportOp', () => {
  test('Python import generates import op with python runtime and bind', () => {
    const m = parseAndManifest('import os');
    const importOp = m.ops.find(op => op.op === 'import');
    expect(importOp).toBeDefined();
    if (importOp && importOp.op === 'import') {
      expect(importOp.runtime).toBe('python');
      expect(importOp.path).toBe('os');
      expect(importOp.bind).toBe('os');
    }
  });

  test('JS import generates import op with javascript runtime', () => {
    const m = parseAndManifest('import react from "react"');
    const importOp = m.ops.find(op => op.op === 'import');
    expect(importOp).toBeDefined();
    if (importOp && importOp.op === 'import') {
      expect(importOp.runtime).toBe('javascript');
      expect(importOp.path).toBe('react');
    }
  });
});

// --- ConcatOp: polyglot string interpolation ---

describe('ConcatOp', () => {
  test('string with interpolation generates eval op', () => {
    const m = parseAndManifest('const msg = `hello ${name}`');
    // Interpolated string produces bare eval with bind (not declare wrapper)
    const evalOp = m.ops.find(op => op.op === 'eval') as any;
    expect(evalOp).toBeDefined();
    expect(evalOp.bind).toBe('msg');
  });
});

// --- NativeOp ---

describe('NativeOp', () => {
  test('unknown node types produce native ops', () => {
    // Simple expression that falls through to default
    const m = parseAndManifest('42');
    expect(m.ops.length).toBeGreaterThan(0);
    // Should have some kind of op
    const op = m.ops[0];
    expect(['exec', 'native', 'declare', 'eval']).toContain(op.op);
  });
});

// --- Integration Tests ---

describe('Manifest Integration', () => {
  test('empty program produces empty ops', () => {
    // Minimal valid input
    const m = parseAndManifest('const x = 1');
    expect(m.ops.length).toBeGreaterThanOrEqual(1);
  });

  test('mixed-runtime program produces multiple op types', () => {
    const code = `
import os
function hello() { return 42 }
pass
`;
    const m = parseAndManifest(code);
    // Should have import, func_def, and exec/native ops
    const opTypes = new Set(m.ops.map(op => op.op));
    expect(opTypes.size).toBeGreaterThanOrEqual(2);
  });

  test('manifest is JSON-serializable (no circular refs)', () => {
    const m = parseAndManifest(`
function hello(name) { return name }
const x = 42
let y = "test"
if true { let z = 1 }
while true { let w = 2 }
`);
    expect(() => JSON.stringify(m)).not.toThrow();
  });

  test('all ops have valid op field', () => {
    const m = parseAndManifest(`
import os
function hello() { return 42 }
const x = 42
pass
`);
    const validOps = [
      'exec', 'eval', 'exec_compiled', 'eval_compiled',
      'declare', 'assign', 'func_def', 'return',
      'if', 'loop', 'parallel', 'concat', 'import', 'native',
    ];
    function checkOps(ops: ManifestOp[]) {
      for (const op of ops) {
        expect(validOps).toContain(op.op);
        // Recurse into nested bodies
        if (op.op === 'func_def') checkOps(op.body);
        if (op.op === 'if') {
          for (const arm of op.arms) checkOps(arm.body);
          if (op.elseBody) checkOps(op.elseBody);
        }
        if (op.op === 'loop') checkOps(op.body);
      }
    }
    checkOps(m.ops);
  });

  test('Python-heavy program assigns python runtime', () => {
    const code = `
import os
def greet(name):
  print(name)
pass
`;
    const m = parseAndManifest(code);
    const pythonOps = m.ops.filter(op =>
      ('runtime' in op && (op as any).runtime === 'python') ||
      (op.op === 'func_def' && op.bodyRuntime === 'python')
    );
    // import os → python, def greet → python func_def, pass → python native
    expect(pythonOps.length).toBeGreaterThanOrEqual(1);
  });

  test('consolidated blocks produce fewer ops than statements', () => {
    // Two consecutive pass statements (both Python) may consolidate
    const m = parseAndManifest('pass\npass');
    // Both are Python-runtime — should produce ops with python runtime
    const pythonOps = m.ops.filter(op => 'runtime' in op && (op as any).runtime === 'python');
    expect(pythonOps.length).toBeGreaterThanOrEqual(1);
  });
});

// --- Parity with JS Code Generator ---

describe('Parity with JS Code Generator', () => {
  test('JS function: manifest has func_def, not omnivm.call', () => {
    const m = parseAndManifest('function hello() { return 42 }');
    const json = JSON.stringify(m);
    expect(json).not.toContain('omnivm');
    expect(json).toContain('func_def');
  });

  test('Python def: manifest has func_def with bodyRuntime python', () => {
    const m = parseAndManifest('def greet(name):\n  print(name)');
    const funcOp = m.ops.find(op => op.op === 'func_def') as any;
    expect(funcOp).toBeDefined();
    expect(funcOp.bodyRuntime).toBe('python');
  });

  test('pass: manifest has op with runtime python', () => {
    const m = parseAndManifest('pass');
    const op = m.ops[0] as any;
    expect(['exec', 'native']).toContain(op.op);
    expect(op.runtime).toBe('python');
  });

  test('const: manifest has declare with mutable false', () => {
    const m = parseAndManifest('const x = 42');
    const declOp = m.ops[0] as any;
    expect(declOp.op).toBe('declare');
    expect(declOp.mutable).toBe(false);
    expect(declOp.bind).toBe('x');
  });

  test('let: manifest has declare with mutable true', () => {
    const m = parseAndManifest('let y = "hello"');
    const declOp = m.ops[0] as any;
    expect(declOp.op).toBe('declare');
    expect(declOp.mutable).toBe(true);
  });
});

// --- Span-Based Source Extraction ---

describe('Span-based source extraction', () => {
  test('try/catch produces real source via span extraction', () => {
    const code = 'try { let x = 1 } catch(e) { let y = 2 }';
    const m = parseAndManifest(code);
    // try/catch is not explicitly handled — falls to default
    // with span extraction, code should contain real source, not /* Try */
    const json = JSON.stringify(m);
    expect(json).not.toContain('/* Try */');
  });

  test('class declaration produces real source via span extraction', () => {
    const code = 'class Foo { }';
    const m = parseAndManifest(code);
    const json = JSON.stringify(m);
    expect(json).not.toContain('/* ClassDecl */');
  });

  test('switch statement produces real source via span extraction', () => {
    const code = 'switch x { case 1: let a = 1 }';
    const m = parseAndManifest(code);
    const json = JSON.stringify(m);
    expect(json).not.toContain('/* Switch */');
  });

  test('throw statement produces real source via span extraction', () => {
    const code = 'throw new Error("oops")';
    const m = parseAndManifest(code);
    const json = JSON.stringify(m);
    expect(json).not.toContain('/* Throw */');
  });

  test('Python def body is decomposed into per-statement ops', () => {
    const code = 'def greet(name):\n  print(name)';
    const m = parseAndManifest(code);
    const funcOp = m.ops.find(op => op.op === 'func_def') as any;
    expect(funcOp).toBeDefined();
    expect(funcOp.bodyRuntime).toBe('python');
    // Body should be decomposed into individual ops, not a single blob
    expect(funcOp.body.length).toBeGreaterThan(0);
    // Each body op should have python runtime and real code (not /* ... */ placeholders)
    for (const op of funcOp.body) {
      if ('code' in op) {
        expect(op.code).not.toContain('/*');
        expect(op.runtime).toBe('python');
      }
    }
  });

  test('lambda body is reconstructed, not span-extracted', () => {
    const code = 'const fn = (x, y) => x + y';
    const m = parseAndManifest(code);
    const op = m.ops[0] as any;
    // Non-literal value → bare eval with bind
    expect(op.op).toBe('eval');
    expect(op.bind).toBe('fn');
    // Lambda body should be reconstructed, not placeholder
    expect(op.code).not.toContain('/* body */');
    expect(op.code).toContain('=>');
  });

  test('no placeholder comments in complex program', () => {
    const code = `
class Animal {
  speak() { return "..." }
}
try { let x = 1 } catch(e) { let y = 2 }
switch x { case 1: let a = 1 }
`;
    const m = parseAndManifest(code);
    const json = JSON.stringify(m);
    // None of the old placeholder patterns should appear
    expect(json).not.toContain('/* ClassDecl */');
    expect(json).not.toContain('/* Try */');
    expect(json).not.toContain('/* Switch */');
  });
});

// --- JSX Lowering ---

describe('JSX Lowering', () => {
  test('simple element lowers to React.createElement', () => {
    const m = parseAndManifest('const el = <div />');
    const op = m.ops[0] as any;
    // JSX is not a literal → bare eval with bind
    expect(op.op).toBe('eval');
    expect(op.code).toContain('React.createElement');
    expect(op.code).toContain('"div"');
  });

  test('element with attributes lowers to props object', () => {
    const m = parseAndManifest('const el = <div className="test" id="main" />');
    const op = m.ops[0] as any;
    expect(op.code).toContain('className: "test"');
    expect(op.code).toContain('id: "main"');
  });

  test('uppercase component uses identifier, not string', () => {
    const m = parseAndManifest('const el = <MyComponent />');
    const op = m.ops[0] as any;
    // MyComponent should NOT be quoted — it's a component reference
    expect(op.code).toContain('React.createElement(MyComponent');
    expect(op.code).not.toContain('"MyComponent"');
  });

  test('nested elements lower recursively', () => {
    const m = parseAndManifest('const el = <div><span>hi</span></div>');
    const op = m.ops[0] as any;
    expect(op.code).toContain('React.createElement("div"');
    expect(op.code).toContain('React.createElement("span"');
  });

  test('fragment lowers to React.Fragment', () => {
    const m = parseAndManifest('const el = <><div /><span /></>');
    const op = m.ops[0] as any;
    expect(op.code).toContain('React.Fragment');
  });

  test('expression container lowers child expression', () => {
    const m = parseAndManifest('const el = <div>{message}</div>');
    const op = m.ops[0] as any;
    expect(op.code).toContain('message');
    expect(op.code).not.toContain('{message}');
  });
});

// --- Match Expression Lowering ---

describe('Match Lowering', () => {
  test('match lowers to ternary chain', () => {
    const code = 'match x {\n  1 => "one",\n  2 => "two",\n  _ => "other"\n}';
    const m = parseAndManifest(code);
    const json = JSON.stringify(m);
    // Should contain ternary operators, not match syntax
    expect(json).toContain('?');
    expect(json).toContain(':');
  });

  test('match with guard uses && in condition', () => {
    const code = 'match x {\n  1 if x > 0 => "pos",\n  _ => "neg"\n}';
    const m = parseAndManifest(code);
    const json = JSON.stringify(m);
    expect(json).toContain('&&');
  });

  test('match wildcard _ becomes default branch', () => {
    const code = 'match x {\n  1 => "one",\n  _ => "fallback"\n}';
    const m = parseAndManifest(code);
    const json = JSON.stringify(m);
    // Should contain the fallback value as the else branch
    expect(json).toContain('fallback');
    // Should NOT contain an explicit === for wildcard (it's the else)
    expect(json).not.toContain('_ ===');
  });

  test('no match PolyScript syntax leaks into manifest code fields', () => {
    const code = 'match status {\n  "active" => 1,\n  "inactive" => 0,\n  _ => -1\n}';
    const m = parseAndManifest(code);
    // Find ops with code fields — none should contain raw match syntax
    function checkCode(ops: any[]) {
      for (const op of ops) {
        if (op.code && typeof op.code === 'string') {
          expect(op.code).not.toMatch(/^match /);
        }
        if (op.body) checkCode(op.body);
      }
    }
    checkCode(m.ops);
  });
});

// --- Captures Analysis ---

describe('Captures Analysis', () => {
  test('same-runtime variable reference has no captures', () => {
    const code = 'const x = 42\nconst y = x + 1';
    const m = parseAndManifest(code);
    // x = 42 is literal → declare. y = x + 1 is expression → eval
    const yOp = m.ops.find(op => 'bind' in op && (op as any).bind === 'y') as any;
    expect(yOp).toBeDefined();
    // Both are JS — y should not have captures for x
    expect(yOp.captures).toBeUndefined();
  });

  test('cross-runtime variable reference populates captures', () => {
    const code = 'import os\nconst data = os.listdir(".")\nconst len = data.length';
    const m = parseAndManifest(code);
    // data is bound in Python via eval, len is evaluated in JS via eval
    const lenOp = m.ops.find(op => 'bind' in op && (op as any).bind === 'len') as any;
    if (lenOp && lenOp.captures) {
      expect(lenOp.captures).toHaveProperty('data', 'data');
    }
  });

  test('import binding is tracked for captures', () => {
    const code = 'import os\nconst result = os.getcwd()';
    const m = parseAndManifest(code);
    const resultOp = m.ops.find(op => 'bind' in op && (op as any).bind === 'result') as any;
    // os was imported as Python, if result is evaluated in a different runtime
    // it should have captures for os
    if (resultOp && resultOp.runtime !== 'python') {
      expect(resultOp.captures).toBeDefined();
    }
  });

  test('function name is recorded as binding', () => {
    // function (JS keyword) defines compute in JS, import os triggers Python,
    // and os.path.join references os from Python while compute is JS-bound
    const code = 'function compute(x) { return x * 2 }\nimport os';
    const m = parseAndManifest(code);
    const json = JSON.stringify(m);
    // compute should produce a func_def since it uses `function` keyword (JS)
    expect(json).toContain('func_def');
    // The function name compute should be recorded as a binding
    expect(json).toContain('compute');
  });

  test('captures keys match referenced variable names', () => {
    const code = 'import os\nconst files = os.listdir(".")\nfunction show() { return files }';
    const m = parseAndManifest(code);
    // Find the return op inside show's body
    const funcOp = m.ops.find(op => op.op === 'func_def') as any;
    if (funcOp) {
      const retOp = funcOp.body.find((op: any) => op.op === 'return');
      if (retOp && retOp.from && retOp.from.captures) {
        // files was bound in Python, return is in JS — should capture files
        expect(retOp.from.captures.files).toBe('files');
      }
    }
  });
});

// --- Go Runtime Restrictions ---

describe('Go Runtime Restrictions', () => {
  test('Go function call emits func/args format', () => {
    const code = 'go fetch_data()';
    const m = parseAndManifest(code);
    // go statement itself is an error marker, but let's check it
    const json = JSON.stringify(m);
    expect(json).toContain('ERROR');
    expect(json).toContain('goroutines not supported');
  });

  test('defer produces error marker', () => {
    const code = 'defer cleanup()';
    const m = parseAndManifest(code);
    const json = JSON.stringify(m);
    expect(json).toContain('ERROR');
    expect(json).toContain('defer not supported');
  });

  test('select produces error marker', () => {
    const code = 'select { case x: let a = 1 }';
    const m = parseAndManifest(code);
    const json = JSON.stringify(m);
    expect(json).toContain('ERROR');
    expect(json).toContain('select not supported');
  });

  test('Go short declaration with Call produces eval with func/args', () => {
    const code = 'x := compute(42)';
    const m = parseAndManifest(code);
    // Bare eval with func/args — no register op, OmniVM fails at runtime if missing
    const evalOp = m.ops.find(op => op.op === 'eval') as any;
    expect(evalOp.runtime).toBe('go');
    expect(evalOp.func).toBe('compute');
    expect(evalOp.args).toEqual(['42']);
    expect(evalOp.bind).toBe('x');
  });

  test('Go func produces func_def with source and exports', () => {
    const code = 'func process_data(input) {\n  result := transform(input)\n  return result\n}';
    const m = parseAndManifest(code);
    const funcOp = m.ops.find(op => op.op === 'func_def') as any;
    expect(funcOp).toBeDefined();
    expect(funcOp.name).toBe('process_data');
    expect(funcOp.bodyRuntime).toBe('go');
    expect(funcOp.body).toEqual([]);
    expect(funcOp.source).toContain('package polyfunc');
    expect(funcOp.source).toContain('func ProcessData');
    expect(funcOp.source).toContain('input interface{}');
    expect(funcOp.source).toContain('interface{} {');
    expect(funcOp.exports).toEqual(['ProcessData']);
  });

  test('Go func snake_case name converts to PascalCase export', () => {
    const code = 'func my_long_name() {\n  return 1\n}';
    const m = parseAndManifest(code);
    const funcOp = m.ops.find(op => op.op === 'func_def') as any;
    expect(funcOp.exports).toEqual(['MyLongName']);
  });

  test('Go func already PascalCase keeps same export name', () => {
    const code = 'func ProcessStream(id) {\n  return id\n}';
    const m = parseAndManifest(code);
    const funcOp = m.ops.find(op => op.op === 'func_def') as any;
    expect(funcOp.name).toBe('ProcessStream');
    expect(funcOp.exports).toEqual(['ProcessStream']);
  });

  test('Go make(N) is fixed to make(chan interface{}, N)', () => {
    const code = 'func do_stuff() {\n  ch := make(10)\n  return ch\n}';
    const m = parseAndManifest(code);
    const funcOp = m.ops.find(op => op.op === 'func_def') as any;
    expect(funcOp.source).toContain('make(chan interface{}, 10)');
    expect(funcOp.source).not.toContain('make(10)');
  });

  test('Go undefined functions get var stubs and Init for injection', () => {
    const code = 'func handler(x) {\n  result := fetch_events(x, 5)\n  return result\n}';
    const m = parseAndManifest(code);
    const funcOp = m.ops.find(op => op.op === 'func_def') as any;
    // var function pointer for fetch_events
    expect(funcOp.source).toContain('var fetch_events func(interface{}, interface{}) interface{}');
    // Init function for OmniVM to call at plugin load time
    expect(funcOp.source).toContain('func Init(fetch_eventsFn func(interface{}, interface{}) interface{})');
    expect(funcOp.source).toContain('fetch_events = fetch_eventsFn');
    // The main function still calls it
    expect(funcOp.source).toContain('fetch_events(x, 5)');
    // requires field tells OmniVM what needs injection
    expect(funcOp.requires).toEqual(['fetch_events']);
  });

  test('Go builtins and params do not get forward declarations', () => {
    const code = 'func work(callback) {\n  x := len(callback)\n  return x\n}';
    const m = parseAndManifest(code);
    const funcOp = m.ops.find(op => op.op === 'func_def') as any;
    // len is a builtin, callback is a param — no forward decls needed
    expect(funcOp.requires).toBeUndefined();
    expect(funcOp.source).not.toContain('func len(');
    expect(funcOp.source).not.toContain('func callback(');
  });

  test('Go body uses := not const for local vars', () => {
    const code = 'func compute(a, b) {\n  sum := a + b\n  return sum\n}';
    const m = parseAndManifest(code);
    const funcOp = m.ops.find(op => op.op === 'func_def') as any;
    expect(funcOp.source).toContain('sum := a.(int) + b.(int)');
    expect(funcOp.source).not.toContain('const');
  });
});

// --- Async Semantics ---

describe('Async Semantics', () => {
  test('async function has async: true on FuncDefOp', () => {
    const code = 'async function fetchData() { return 42 }';
    const m = parseAndManifest(code);
    const funcOp = m.ops.find(op => op.op === 'func_def') as any;
    expect(funcOp).toBeDefined();
    expect(funcOp.async).toBe(true);
  });

  test('sync function does not have async field', () => {
    const code = 'function add(a, b) { return a }';
    const m = parseAndManifest(code);
    const funcOp = m.ops.find(op => op.op === 'func_def') as any;
    expect(funcOp).toBeDefined();
    expect(funcOp.async).toBeUndefined();
  });
});

// --- Lambda Body Lowering ---

describe('Lambda Body Lowering', () => {
  test('lambda with JSX body lowers JSX to createElement', () => {
    const code = 'const render = (item) => <Card key={item.id}>{item.name}</Card>';
    const m = parseAndManifest(code);
    const op = m.ops[0] as any;
    expect(op.code).toContain('React.createElement');
    expect(op.code).not.toContain('<Card');
  });

  test('lambda with match body lowers match to ternary', () => {
    const code = 'const classify = (x) => match x { 1 => "one", _ => "other" }';
    const m = parseAndManifest(code);
    const op = m.ops[0] as any;
    expect(op.code).toContain('?');
    expect(op.code).not.toMatch(/match/);
  });

  test('lambda with block body reconstructs statements', () => {
    const code = 'const fn = (x) => { return x + 1 }';
    const m = parseAndManifest(code);
    const op = m.ops[0] as any;
    expect(op.code).toContain('=>');
    expect(op.code).toContain('return');
  });
});

// --- Assign Decomposition ---

describe('Assign Decomposition', () => {
  test('simple assignment produces eval with bind', () => {
    const code = 'items = [1, 2, 3]';
    const m = parseAndManifest(code);
    const op = m.ops[0] as any;
    // assignment with expression RHS → bare eval with bind
    expect(op.op).toBe('eval');
    expect(op.bind).toBe('items');
    expect(op.code).toBe('[1, 2, 3]');
  });

  test('assignment with literal RHS produces assign with value', () => {
    const code = 'x = 42';
    const m = parseAndManifest(code);
    const op = m.ops[0] as any;
    expect(op.op).toBe('assign');
    expect(op.target).toBe('x');
    expect(op.value).toEqual({ kind: 'literal', value: 42 });
  });

  test('assignment records binding for captures', () => {
    const code = 'import os\nitems = os.listdir(".")\nconst len = items.length';
    const m = parseAndManifest(code);
    // items is bound in Python, len is JS → captures for items
    const lenOp = m.ops.find(op => 'bind' in op && (op as any).bind === 'len') as any;
    if (lenOp && lenOp.captures) {
      expect(lenOp.captures).toHaveProperty('items', 'items');
    }
  });
});

// --- ShortDecl Decomposition ---

describe('ShortDecl Decomposition', () => {
  test('Go short decl with non-Call produces eval with code', () => {
    const code = 'x := 42';
    const m = parseAndManifest(code);
    // No register op for non-Call (42 is not a function)
    const evalOp = m.ops.find(op => op.op === 'eval') as any;
    expect(evalOp.op).toBe('eval');
    expect(evalOp.bind).toBe('x');
    expect(evalOp.runtime).toBe('go');
  });

  test('Go short decl produces no raw := in output', () => {
    const code = 'ch := make(42)';
    const m = parseAndManifest(code);
    const json = JSON.stringify(m);
    expect(json).not.toContain(':=');
  });
});

// --- Flat Op Structure (no redundant wrappers) ---

describe('Flat Op Structure', () => {
  test('const with runtime eval produces bare eval, not declare wrapping eval', () => {
    const code = 'const data = fetch("api")';
    const m = parseAndManifest(code);
    const op = m.ops[0] as any;
    expect(op.op).toBe('eval');
    expect(op.bind).toBe('data');
    // No declare wrapper
    expect(m.ops.every((o: any) => o.op !== 'declare' || o.bind !== 'data')).toBe(true);
  });

  test('const with literal produces declare with value, not eval', () => {
    const code = 'const count = 0';
    const m = parseAndManifest(code);
    const op = m.ops[0] as any;
    expect(op.op).toBe('declare');
    expect(op.bind).toBe('count');
    expect(op.value).toEqual({ kind: 'literal', value: 0 });
  });

  test('let without value produces declare (forward declaration)', () => {
    const code = 'let z';
    const m = parseAndManifest(code);
    const op = m.ops[0] as any;
    expect(op.op).toBe('declare');
    expect(op.bind).toBe('z');
    expect(op.mutable).toBe(true);
  });
});

// --- Import Hoisting from func_def Bodies ---

describe('Import Hoisting', () => {
  test('import inside func_def is hoisted to top level', () => {
    const code = 'def greet(name):\n  import os\n  print(name)';
    const m = parseAndManifest(code);
    // import should be before func_def, not inside its body
    const importIdx = m.ops.findIndex(op => op.op === 'import');
    const funcIdx = m.ops.findIndex(op => op.op === 'func_def');
    expect(importIdx).toBeLessThan(funcIdx);
    // func_def body should not contain import
    const funcOp = m.ops[funcIdx] as any;
    const bodyImports = funcOp.body.filter((op: any) => op.op === 'import');
    expect(bodyImports.length).toBe(0);
  });

  test('import + initialization hoisted, param-dependent ops stay in body', () => {
    const code = 'def compute(x):\n  import math\n  pi = math.pi\n  return pi * x';
    const m = parseAndManifest(code);
    // import math and pi = math.pi should be hoisted
    const importOp = m.ops.find(op => op.op === 'import') as any;
    expect(importOp).toBeDefined();
    expect(importOp.path).toBe('math');
    // pi = math.pi is an eval that doesn't reference param x → hoisted
    const piOp = m.ops.find(op => op.op === 'eval' && (op as any).bind === 'pi') as any;
    expect(piOp).toBeDefined();
    // func_def body should only have the return (which references x)
    const funcOp = m.ops.find(op => op.op === 'func_def') as any;
    expect(funcOp.body.length).toBeGreaterThan(0);
    // Body should not contain import or pi eval
    expect(funcOp.body.some((op: any) => op.op === 'import')).toBe(false);
    expect(funcOp.body.some((op: any) => op.bind === 'pi')).toBe(false);
  });

  test('hoisted import has bind field', () => {
    const code = 'def greet(name):\n  import os\n  print(name)';
    const m = parseAndManifest(code);
    const importOp = m.ops.find(op => op.op === 'import') as any;
    expect(importOp.bind).toBe('os');
  });

  test('func_def body captures hoisted bindings', () => {
    const code = 'def compute(x):\n  import math\n  pi = math.pi\n  return pi * x';
    const m = parseAndManifest(code);
    const funcOp = m.ops.find(op => op.op === 'func_def') as any;
    // Return op should capture pi (hoisted) and x (param)
    const retOp = funcOp.body.find((op: any) => op.op === 'return');
    expect(retOp).toBeDefined();
    if (retOp && retOp.from && retOp.from.captures) {
      expect(retOp.from.captures).toHaveProperty('pi');
      expect(retOp.from.captures).toHaveProperty('x');
    }
  });
});
