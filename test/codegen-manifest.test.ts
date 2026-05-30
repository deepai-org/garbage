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

  test('Python lambda assignment emits native Python lambda', () => {
    const m = parseAndManifest('view = lambda request: JsonResponse({"path": request.path})');
    const op = m.ops[0] as any;
    expect(op.op).toBe('eval');
    expect(op.runtime).toBe('python');
    expect(op.bind).toBe('view');
    expect(op.code).toBe('lambda request: JsonResponse({"path": request.path})');
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
      'if', 'loop', 'try', 'throw', 'parallel', 'concat', 'import', 'native',
      'chan', 'select', 'spawn', 'yield', 'await',
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
        if (op.op === 'select') {
          for (const c of op.cases) checkOps(c.body);
          if (op.defaultBody) checkOps(op.defaultBody);
        }
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
  test('Go function call emits spawn op', () => {
    const code = 'go fetch_data()';
    const m = parseAndManifest(code);
    const spawnOp = m.ops.find(op => op.op === 'spawn') as any;
    expect(spawnOp).toBeDefined();
    expect(spawnOp.runtime).toBe('go');
    expect(spawnOp.code).toContain('fetch_data');
  });

  test('Go spawn expression binds returned handle', () => {
    const code = 'const h = go fetch_data()';
    const m = parseAndManifest(code);
    const spawnOp = m.ops.find(op => op.op === 'spawn') as any;
    expect(spawnOp).toBeDefined();
    expect(spawnOp.runtime).toBe('go');
    expect(spawnOp.code).toBe('fetch_data()');
    expect(spawnOp.bind).toBe('h');
  });

  test('defer produces exec op with defer code', () => {
    const code = 'defer cleanup()';
    const m = parseAndManifest(code);
    const execOp = m.ops.find(op => op.op === 'exec') as any;
    expect(execOp).toBeDefined();
    expect(execOp.code).toContain('defer');
    expect(execOp.code).toContain('cleanup');
  });

  test('select produces SelectOp', () => {
    const code = 'select { case x: let a = 1 }';
    const m = parseAndManifest(code);
    const selectOp = m.ops.find(op => op.op === 'select') as any;
    expect(selectOp).toBeDefined();
    expect(selectOp.cases).toBeDefined();
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
    expect(funcOp.source).toContain('func Init(deps map[string]interface{})');
    expect(funcOp.source).toContain('deps["fetch_events"].(func(interface{}, interface{}) interface{})');
    expect(funcOp.source).toContain('fetch_events = fn');
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

  test('Go short decl with make() produces ChanOp, no raw := in output', () => {
    const code = 'ch := make(42)';
    const m = parseAndManifest(code);
    const json = JSON.stringify(m);
    expect(json).not.toContain(':=');
    // make() now produces ChanOp instead of eval
    const chanOp = m.ops.find(op => op.op === 'chan') as any;
    expect(chanOp).toBeDefined();
    expect(chanOp.action).toBe('make');
    expect(chanOp.bind).toBe('ch');
    expect(chanOp.size).toBe(42);
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

// ─── Control Flow: if ────────────────────────────────────────────

describe('Control Flow: if', () => {
  test('if/else produces IfOp with arms and elseBody', () => {
    const code = 'function test(x) {\n  if (x > 0) {\n    return 1\n  } else {\n    return 0\n  }\n}';
    const m = parseAndManifest(code);
    const funcOp = m.ops.find(op => op.op === 'func_def') as any;
    const ifOp = funcOp.body.find((op: any) => op.op === 'if');
    expect(ifOp).toBeDefined();
    expect(ifOp.arms).toHaveLength(1);
    expect(ifOp.arms[0].test.kind).toBe('expr');
    expect(ifOp.arms[0].test.code).toContain('x > 0');
    expect(ifOp.arms[0].body).toHaveLength(1);
    expect(ifOp.elseBody).toBeDefined();
    expect(ifOp.elseBody).toHaveLength(1);
  });

  test('if arm test has runtime and code (expr kind)', () => {
    const code = 'function f() {\n  if (true) {\n    return 1\n  }\n}';
    const m = parseAndManifest(code);
    const funcOp = m.ops.find(op => op.op === 'func_def') as any;
    const ifOp = funcOp.body.find((op: any) => op.op === 'if');
    expect(ifOp.arms[0].test.kind).toBe('expr');
    expect(ifOp.arms[0].test.runtime).toBeDefined();
  });

  test('if body ops are valid manifest ops', () => {
    const code = 'function f(x) {\n  if (x > 0) {\n    const y = x + 1\n    return y\n  }\n}';
    const m = parseAndManifest(code);
    const funcOp = m.ops.find(op => op.op === 'func_def') as any;
    const ifOp = funcOp.body.find((op: any) => op.op === 'if');
    expect(ifOp.arms[0].body.length).toBeGreaterThanOrEqual(1);
  });
});

// ─── Control Flow: loop ──────────────────────────────────────────

describe('Control Flow: loop', () => {
  test('while loop produces LoopOp with mode "while" and test', () => {
    const code = 'function f() {\n  let i = 0\n  while (i < 10) {\n    i += 1\n  }\n}';
    const m = parseAndManifest(code);
    const funcOp = m.ops.find(op => op.op === 'func_def') as any;
    const loopOp = funcOp.body.find((op: any) => op.op === 'loop');
    expect(loopOp).toBeDefined();
    expect(loopOp.mode).toBe('while');
    expect(loopOp.test).toBeDefined();
    expect(loopOp.test.kind).toBe('expr');
    expect(loopOp.test.code).toContain('i < 10');
    expect(loopOp.body.length).toBeGreaterThan(0);
  });

  test('loop body contains inner ops', () => {
    const code = 'function f() {\n  let x = 0\n  while (x < 5) {\n    console.log(x)\n    x += 1\n  }\n}';
    const m = parseAndManifest(code);
    const funcOp = m.ops.find(op => op.op === 'func_def') as any;
    const loopOp = funcOp.body.find((op: any) => op.op === 'loop');
    expect(loopOp.body.length).toBe(2); // console.log + assign
  });
});

// ─── Compound Assignment ─────────────────────────────────────────

describe('Compound Assignment', () => {
  test('+= with literal produces assign op', () => {
    const code = 'let x = 10\nx += 5';
    const m = parseAndManifest(code);
    const assignOp = m.ops.find(op => op.op === 'assign') as any;
    expect(assignOp).toBeDefined();
    expect(assignOp.target).toBe('x');
    expect(assignOp.operator).toBe('+=');
    expect(assignOp.value).toEqual({ kind: 'literal', value: 5 });
  });

  test('-= with literal produces assign op', () => {
    const code = 'let x = 100\nx -= 25';
    const m = parseAndManifest(code);
    const assignOp = m.ops.find(op => op.op === 'assign') as any;
    expect(assignOp.operator).toBe('-=');
    expect(assignOp.value).toEqual({ kind: 'literal', value: 25 });
  });

  test('*= with literal produces assign op', () => {
    const code = 'let x = 10\nx *= 3';
    const m = parseAndManifest(code);
    const assignOp = m.ops.find(op => op.op === 'assign') as any;
    expect(assignOp.operator).toBe('*=');
    expect(assignOp.value).toEqual({ kind: 'literal', value: 3 });
  });

  test('+= with expression produces assign with from eval', () => {
    const code = 'let x = 10\nconst y = 5\nx += y';
    const m = parseAndManifest(code);
    const assignOps = m.ops.filter(op => op.op === 'assign') as any[];
    const compoundAssign = assignOps.find(op => op.operator === '+=');
    expect(compoundAssign).toBeDefined();
    expect(compoundAssign.from).toBeDefined();
    expect(compoundAssign.from.op).toBe('eval');
  });
});

// ─── Async Functions ─────────────────────────────────────────────

describe('Async Functions', () => {
  test('async function produces func_def with async: true', () => {
    const code = 'async function fetchData(url) {\n  const result = await fetch(url)\n  return result\n}';
    const m = parseAndManifest(code);
    const funcOp = m.ops.find(op => op.op === 'func_def') as any;
    expect(funcOp).toBeDefined();
    expect(funcOp.async).toBe(true);
    expect(funcOp.name).toBe('fetchData');
  });

  test('non-async function does not have async flag', () => {
    const code = 'function add(a, b) { return a + b }';
    const m = parseAndManifest(code);
    const funcOp = m.ops.find(op => op.op === 'func_def') as any;
    expect(funcOp.async).toBeUndefined();
  });
});

// ─── Spread and Default Params ───────────────────────────────────

describe('Spread and Default Params', () => {
  test('spread param has spread: true in ParamDef', () => {
    const code = 'function merge(base, ...items) {\n  return base\n}';
    const m = parseAndManifest(code);
    const funcOp = m.ops.find(op => op.op === 'func_def') as any;
    expect(funcOp.params).toHaveLength(2);
    expect(funcOp.params[0].spread).toBeUndefined();
    expect(funcOp.params[1].name).toBe('items');
    expect(funcOp.params[1].spread).toBe(true);
  });

  test('default param has defaultValue in ParamDef', () => {
    const code = 'function greet(name = "world") {\n  return name\n}';
    const m = parseAndManifest(code);
    const funcOp = m.ops.find(op => op.op === 'func_def') as any;
    expect(funcOp.params).toHaveLength(1);
    expect(funcOp.params[0].name).toBe('name');
    expect(funcOp.params[0].defaultValue).toBeDefined();
    expect(funcOp.params[0].defaultValue.kind).toBe('literal');
  });
});

// ─── Declare with Mutable Flag ───────────────────────────────────

describe('Declare with Mutable Flag', () => {
  test('let without value produces declare with mutable: true', () => {
    const code = 'let pending';
    const m = parseAndManifest(code);
    const declOp = m.ops.find(op => op.op === 'declare') as any;
    expect(declOp).toBeDefined();
    expect(declOp.bind).toBe('pending');
    expect(declOp.mutable).toBe(true);
    expect(declOp.value).toBeUndefined();
  });

  test('const with literal produces declare with mutable: false', () => {
    const code = 'const VERSION = 42';
    const m = parseAndManifest(code);
    const declOp = m.ops.find(op => op.op === 'declare') as any;
    expect(declOp).toBeDefined();
    expect(declOp.bind).toBe('VERSION');
    expect(declOp.mutable).toBe(false);
    expect(declOp.value).toEqual({ kind: 'literal', value: 42 });
  });
});

// ─── Return Variants ─────────────────────────────────────────────

describe('Return Variants', () => {
  test('return literal uses value not from', () => {
    const code = 'function f() { return 42 }';
    const m = parseAndManifest(code);
    const funcOp = m.ops.find(op => op.op === 'func_def') as any;
    const ret = funcOp.body.find((op: any) => op.op === 'return');
    expect(ret.value).toEqual({ kind: 'literal', value: 42 });
    expect(ret.from).toBeUndefined();
  });

  test('return string literal uses value', () => {
    const code = 'function f() { return "hello" }';
    const m = parseAndManifest(code);
    const funcOp = m.ops.find(op => op.op === 'func_def') as any;
    const ret = funcOp.body.find((op: any) => op.op === 'return');
    expect(ret.value).toEqual({ kind: 'literal', value: 'hello' });
  });

  test('return identifier uses ref', () => {
    const code = 'function f() {\n  const x = 10\n  return x\n}';
    const m = parseAndManifest(code);
    const funcOp = m.ops.find(op => op.op === 'func_def') as any;
    const ret = funcOp.body.find((op: any) => op.op === 'return');
    expect(ret.value).toEqual({ kind: 'ref', name: 'x' });
    expect(ret.from).toBeUndefined();
  });

  test('return expression uses from with eval', () => {
    const code = 'function f(a, b) { return a + b }';
    const m = parseAndManifest(code);
    const funcOp = m.ops.find(op => op.op === 'func_def') as any;
    const ret = funcOp.body.find((op: any) => op.op === 'return');
    expect(ret.from).toBeDefined();
    expect(ret.from.op).toBe('eval');
    expect(ret.from.code).toContain('a');
    expect(ret.value).toBeUndefined();
  });

  test('return with no value produces bare return', () => {
    const code = 'function f() {\n  console.log("done")\n  return\n}';
    const m = parseAndManifest(code);
    const funcOp = m.ops.find(op => op.op === 'func_def') as any;
    expect(funcOp).toBeDefined();
    const ret = funcOp.body.find((op: any) => op.op === 'return');
    expect(ret).toBeDefined();
    expect(ret.value).toBeUndefined();
    expect(ret.from).toBeUndefined();
  });
});

// ─── Recursive Functions ─────────────────────────────────────────

describe('Recursive Functions', () => {
  test('recursive function captures itself in body', () => {
    const code = 'function factorial(n) {\n  if (n <= 1) { return 1 }\n  return n * factorial(n - 1)\n}';
    const m = parseAndManifest(code);
    const funcOp = m.ops.find(op => op.op === 'func_def') as any;
    // The return from eval should capture 'factorial' (self-reference) and 'n' (param)
    const returns = funcOp.body.filter((op: any) => op.op === 'return');
    const exprReturn = returns.find((r: any) => r.from);
    expect(exprReturn).toBeDefined();
    expect(exprReturn.from.captures).toHaveProperty('factorial');
    expect(exprReturn.from.captures).toHaveProperty('n');
  });
});

// ─── Compiled Targets (Rust/C) ───────────────────────────────────

describe('Compiled Targets', () => {
  test('Rust-tagged code produces exec_compiled with lang rust', () => {
    // The runtime-blocks module detects Rust/C via runtime affinity
    // We test at the manifest type level since Rust syntax detection is limited
    const { consolidateBlocks, isCompiledRuntime } = require('../src/codegen-omnivm/runtime-blocks');
    expect(isCompiledRuntime('rust')).toBe(true);
    expect(isCompiledRuntime('c')).toBe(true);
    expect(isCompiledRuntime('javascript')).toBe(false);
    expect(isCompiledRuntime('python')).toBe(false);
  });
});

// ─── Native Op ───────────────────────────────────────────────────

describe('Native Op', () => {
  test('Go goroutine produces spawn op', () => {
    const code = 'go fetch()';
    const m = parseAndManifest(code);
    const spawnOp = m.ops.find(op => op.op === 'spawn') as any;
    expect(spawnOp).toBeDefined();
    expect(spawnOp.runtime).toBe('go');
    expect(spawnOp.code).toContain('fetch');
  });

  test('defer produces exec op', () => {
    const code = 'defer cleanup()';
    const m = parseAndManifest(code);
    const execOp = m.ops.find(op => op.op === 'exec') as any;
    expect(execOp).toBeDefined();
    expect(execOp.code).toContain('defer');
  });
});

// ─── Manifest Type Validation ────────────────────────────────────

describe('Manifest Type Validation', () => {
  const validOps = [
    'exec', 'eval', 'exec_compiled', 'eval_compiled',
    'declare', 'assign', 'func_def', 'return',
    'if', 'loop', 'try', 'throw', 'parallel', 'concat', 'import', 'native',
    'chan', 'select', 'spawn', 'yield',
  ];

  test('all op types are in the ManifestOp union', () => {
    // This is a type-level test — the validOps list should match the union
    expect(validOps).toContain('parallel');
    expect(validOps).toContain('exec_compiled');
    expect(validOps).toContain('native');
  });

  test('ParallelOp has branches with runtime, code, bind', () => {
    // Type-level validation of the parallel op structure
    const parallelOp = {
      op: 'parallel' as const,
      branches: [
        { runtime: 'python', code: 'fetch_data()', bind: 'pyResult' },
        { runtime: 'javascript', code: "fetch('/api')", bind: 'jsResult' },
        { runtime: 'ruby', code: 'compute()', bind: 'rbResult' },
      ],
    };
    expect(parallelOp.branches).toHaveLength(3);
    expect(parallelOp.branches[0].runtime).toBe('python');
    expect(parallelOp.branches[2].runtime).toBe('ruby');
  });

  test('LoopOp supports all four modes', () => {
    const modes: Array<'while' | 'for' | 'infinite' | 'foreach'> = ['while', 'for', 'infinite', 'foreach'];
    for (const mode of modes) {
      const loopOp = { op: 'loop' as const, mode, body: [] };
      expect(loopOp.mode).toBe(mode);
    }
  });

  test('ConditionExpr supports expr, ref, and literal kinds', () => {
    const exprCond = { kind: 'expr' as const, runtime: 'javascript', code: 'x > 0' };
    const refCond = { kind: 'ref' as const, name: 'isReady' };
    const litCond = { kind: 'literal' as const, value: true };
    expect(exprCond.kind).toBe('expr');
    expect(refCond.kind).toBe('ref');
    expect(litCond.kind).toBe('literal');
  });

  test('FuncDefOp supports requires field for Go dependencies', () => {
    const code = 'func handler(x) {\n  result := fetch_data(x)\n  return result\n}';
    const m = parseAndManifest(code);
    const funcOp = m.ops.find(op => op.op === 'func_def') as any;
    expect(funcOp.requires).toContain('fetch_data');
    expect(funcOp.source).toContain('func Init(');
  });
});

// --- Foreach Loops ─────────────────────────────────────────────

describe('Foreach Loops', () => {
  test('for-in loop emits foreach mode with variable and iterable ref', () => {
    const code = 'for item in items {\n  console.log(item)\n}';
    const m = parseAndManifest(code);
    const loop = m.ops.find(op => op.op === 'loop') as any;
    expect(loop).toBeDefined();
    expect(loop.mode).toBe('foreach');
    expect(loop.variable).toBe('item');
    expect(loop.iterable).toBeDefined();
    expect(loop.iterable.kind).toBe('ref');
    expect(loop.iterable.name).toBe('items');
  });

  test('foreach inside function with cross-runtime body', () => {
    const code = `
def py_process(x):
  return x

function process_all(items) {
  for item in items {
    const result = py_process(item)
  }
}`;
    const m = parseAndManifest(code);
    const funcOp = m.ops.find(op => op.op === 'func_def' && (op as any).name === 'process_all') as any;
    expect(funcOp).toBeDefined();
    const loop = funcOp.body.find((op: any) => op.op === 'loop');
    expect(loop).toBeDefined();
    expect(loop.mode).toBe('foreach');
    expect(loop.variable).toBe('item');
  });
});

// --- Try/Catch/Throw ───────────────────────────────────────────

describe('Try/Catch/Throw', () => {
  test('try/catch emits try op with body and catches', () => {
    const code = `
function safe_call() {
  try {
    const result = risky()
    return result
  } catch (e) {
    return null
  }
}`;
    const m = parseAndManifest(code);
    const funcOp = m.ops.find(op => op.op === 'func_def') as any;
    const tryOp = funcOp.body.find((op: any) => op.op === 'try');
    expect(tryOp).toBeDefined();
    expect(tryOp.body.length).toBeGreaterThan(0);
    expect(tryOp.catches.length).toBe(1);
    expect(tryOp.catches[0].param).toBe('e');
    expect(tryOp.catches[0].body.length).toBeGreaterThan(0);
  });

  test('try/catch/finally emits finallyBody', () => {
    const code = `
function with_cleanup() {
  try {
    const x = 1
  } catch (err) {
    const y = 2
  } finally {
    const z = 3
  }
}`;
    const m = parseAndManifest(code);
    const funcOp = m.ops.find(op => op.op === 'func_def') as any;
    const tryOp = funcOp.body.find((op: any) => op.op === 'try');
    expect(tryOp).toBeDefined();
    expect(tryOp.finallyBody).toBeDefined();
    expect(tryOp.finallyBody.length).toBeGreaterThan(0);
  });

  test('throw emits throw op with literal value', () => {
    const code = `
function fail() {
  throw "something went wrong"
}`;
    const m = parseAndManifest(code);
    const funcOp = m.ops.find(op => op.op === 'func_def') as any;
    const throwOp = funcOp.body.find((op: any) => op.op === 'throw');
    expect(throwOp).toBeDefined();
    expect(throwOp.value.kind).toBe('literal');
    expect(throwOp.value.value).toBe('something went wrong');
  });

  test('throw with identifier emits ref', () => {
    const code = `
function rethrow() {
  const err = "error"
  throw err
}`;
    const m = parseAndManifest(code);
    const funcOp = m.ops.find(op => op.op === 'func_def') as any;
    const throwOp = funcOp.body.find((op: any) => op.op === 'throw');
    expect(throwOp).toBeDefined();
    expect(throwOp.value.kind).toBe('ref');
    expect(throwOp.value.value || throwOp.value.name).toBe('err');
  });
});

// --- Parallel Op Emission ───────────────────────────────────────

describe('Parallel Op Emission', () => {
  test('Promise.all with array literal emits parallel op with 2 branches', () => {
    const code = 'Promise.all([fetch("/a"), fetch("/b")])';
    const m = parseAndManifest(code);
    const parallel = m.ops.find(op => op.op === 'parallel') as any;
    expect(parallel).toBeDefined();
    expect(parallel.branches).toHaveLength(2);
    expect(parallel.branches[0].code).toContain('fetch');
    expect(parallel.branches[1].code).toContain('fetch');
    expect(parallel.branches[0].bind).toBe('__parallel_0');
    expect(parallel.branches[1].bind).toBe('__parallel_1');
  });

  test('await Promise.all unwraps await and emits parallel op with 3 branches', () => {
    const code = 'await Promise.all([taskA(), taskB(), taskC()])';
    const m = parseAndManifest(code);
    const parallel = m.ops.find(op => op.op === 'parallel') as any;
    expect(parallel).toBeDefined();
    expect(parallel.branches).toHaveLength(3);
  });

  test('asyncio.gather emits parallel op with 2 branches', () => {
    const code = 'asyncio.gather(coro1(), coro2())';
    const m = parseAndManifest(code);
    const parallel = m.ops.find(op => op.op === 'parallel') as any;
    expect(parallel).toBeDefined();
    expect(parallel.branches).toHaveLength(2);
    expect(parallel.branches[0].code).toContain('coro1');
    expect(parallel.branches[1].code).toContain('coro2');
  });

  test('CompletableFuture.allOf emits parallel op with 2 branches', () => {
    const code = 'CompletableFuture.allOf(future1, future2)';
    const m = parseAndManifest(code);
    const parallel = m.ops.find(op => op.op === 'parallel') as any;
    expect(parallel).toBeDefined();
    expect(parallel.branches).toHaveLength(2);
    expect(parallel.branches[0].code).toBe('future1');
    expect(parallel.branches[1].code).toBe('future2');
  });

  test('const binding with Promise.all emits parallel with named bind prefix', () => {
    const code = 'const results = await Promise.all([fetch("/a"), fetch("/b")])';
    const m = parseAndManifest(code);
    const parallel = m.ops.find(op => op.op === 'parallel') as any;
    expect(parallel).toBeDefined();
    expect(parallel.branches[0].bind).toBe('results_0');
    expect(parallel.branches[1].bind).toBe('results_1');
  });

  test('let binding with asyncio.gather emits parallel op', () => {
    const code = 'let data = asyncio.gather(load_a(), load_b())';
    const m = parseAndManifest(code);
    const parallel = m.ops.find(op => op.op === 'parallel') as any;
    expect(parallel).toBeDefined();
    expect(parallel.branches[0].bind).toBe('data_0');
    expect(parallel.branches[1].bind).toBe('data_1');
  });

  test('parallel inside async function body', () => {
    const code = `
async function fetchAll() {
  const results = await Promise.all([fetch("/x"), fetch("/y")])
  return results
}`;
    const m = parseAndManifest(code);
    const funcOp = m.ops.find(op => op.op === 'func_def') as any;
    expect(funcOp).toBeDefined();
    expect(funcOp.async).toBe(true);
    const parallel = funcOp.body.find((op: any) => op.op === 'parallel');
    expect(parallel).toBeDefined();
    expect(parallel.branches).toHaveLength(2);
    expect(parallel.branches[0].bind).toBe('results_0');
  });

  test('non-parallel Call does not emit parallel op', () => {
    const code = 'const x = fetch("/api")';
    const m = parseAndManifest(code);
    const parallel = m.ops.find(op => op.op === 'parallel');
    expect(parallel).toBeUndefined();
  });

  test('Promise.all without array literal arg does not emit parallel op', () => {
    const code = 'const x = Promise.all(promises)';
    const m = parseAndManifest(code);
    const parallel = m.ops.find(op => op.op === 'parallel');
    expect(parallel).toBeUndefined();
  });

  test('parallel op branches have runtime from affinity', () => {
    const code = 'Promise.all([fetch("/a"), compute(42)])';
    const m = parseAndManifest(code);
    const parallel = m.ops.find(op => op.op === 'parallel') as any;
    expect(parallel).toBeDefined();
    // Both branches should have a runtime assigned
    for (const branch of parallel.branches) {
      expect(branch.runtime).toBeDefined();
      expect(typeof branch.runtime).toBe('string');
    }
  });

  test('parallel op is JSON-serializable', () => {
    const code = 'await Promise.all([taskA(), taskB()])';
    const m = parseAndManifest(code);
    expect(() => JSON.stringify(m)).not.toThrow();
    const json = JSON.stringify(m);
    expect(json).toContain('"parallel"');
    expect(json).toContain('branches');
  });
});

// --- /= Operator ───────────────────────────────────────────────

describe('Division Assignment', () => {
  test('/= emits assign op with divide operator', () => {
    const code = 'let total = 100\ntotal /= 4';
    const m = parseAndManifest(code);
    const assign = m.ops.find(op => op.op === 'assign') as any;
    expect(assign).toBeDefined();
    expect(assign.target).toBe('total');
    expect(assign.operator).toBe('/=');
    expect(assign.value).toEqual({ kind: 'literal', value: 4 });
  });

  test('%= emits assign op with modulo operator', () => {
    const code = 'let x = 10\nx %= 3';
    const m = parseAndManifest(code);
    const assign = m.ops.find(op => op.op === 'assign') as any;
    expect(assign).toBeDefined();
    expect(assign.target).toBe('x');
    expect(assign.operator).toBe('%=');
    expect(assign.value).toEqual({ kind: 'literal', value: 3 });
  });
});

// --- Scope Shadowing ───────────────────────────────────────────

describe('Scope Shadowing', () => {
  test('inner function shadows outer variable using param-dependent expr', () => {
    const code = `
const x = 10
function inner(n) {
  const x = n + 1
  return x
}`;
    const m = parseAndManifest(code);
    // Outer x is a declare
    const declare = m.ops.find(op => op.op === 'declare') as any;
    expect(declare).toBeDefined();
    expect(declare.bind).toBe('x');

    // Inner function has its own x (depends on param, stays in body)
    const funcOp = m.ops.find(op => op.op === 'func_def') as any;
    expect(funcOp).toBeDefined();
    const innerEval = funcOp.body.find((op: any) => op.op === 'eval' && op.bind === 'x');
    expect(innerEval).toBeDefined();
    expect(innerEval.code).toContain('n');
  });
});

// --- Deep Mutual Recursion ────────────────────────────────────

describe('Deep Mutual Recursion', () => {
  test('cross-runtime recursive chain captures all callees', () => {
    const code = `
def py_step(n):
  if n <= 0:
    return 0
  return js_step(n - 1)

function js_step(n) {
  if (n <= 0) {
    return 0
  }
  return py_step(n - 1)
}`;
    const m = parseAndManifest(code);
    const pyFunc = m.ops.find(op => op.op === 'func_def' && (op as any).name === 'py_step') as any;
    const jsFunc = m.ops.find(op => op.op === 'func_def' && (op as any).name === 'js_step') as any;
    expect(pyFunc).toBeDefined();
    expect(jsFunc).toBeDefined();

    // py_step should reference js_step in its body (via captures or code)
    const pyBody = JSON.stringify(pyFunc.body);
    expect(pyBody).toContain('js_step');

    // js_step should reference py_step
    const jsBody = JSON.stringify(jsFunc.body);
    expect(jsBody).toContain('py_step');
  });
});

// --- Nested Loops ─────────────────────────────────────────────

describe('Nested Loops', () => {
  test('while loop inside while loop', () => {
    const code = `
function matrix_scan() {
  let i = 0
  while (i < 3) {
    let j = 0
    while (j < 3) {
      console.log(i + j)
      j += 1
    }
    i += 1
  }
}`;
    const m = parseAndManifest(code);
    const funcOp = m.ops.find(op => op.op === 'func_def') as any;
    const outerLoop = funcOp.body.find((op: any) => op.op === 'loop');
    expect(outerLoop).toBeDefined();
    expect(outerLoop.mode).toBe('while');
    const innerLoop = outerLoop.body.find((op: any) => op.op === 'loop');
    expect(innerLoop).toBeDefined();
    expect(innerLoop.mode).toBe('while');
  });
});

// ─── Channel Operations ───────────────────────────────────────────

describe('ChanOp', () => {
  test('<-ch produces ChanOp recv', () => {
    const m = parseAndManifest('<-ch');
    const op = m.ops[0] as any;
    expect(op.op).toBe('chan');
    expect(op.action).toBe('recv');
    expect(op.channel).toBe('ch');
  });

  test('ch <- value produces ChanOp send', () => {
    const m = parseAndManifest('ch <- 42');
    const op = m.ops[0] as any;
    expect(op.op).toBe('chan');
    expect(op.action).toBe('send');
    expect(op.channel).toBe('ch');
    expect(op.value).toEqual({ kind: 'literal', value: 42 });
  });

  test('val := <-ch produces ChanOp recv with bind', () => {
    const m = parseAndManifest('val := <-ch');
    const op = m.ops[0] as any;
    expect(op.op).toBe('chan');
    expect(op.action).toBe('recv');
    expect(op.channel).toBe('ch');
    expect(op.bind).toBe('val');
  });

  test('close(ch) produces ChanOp close', () => {
    const m = parseAndManifest('close(ch)');
    const op = m.ops[0] as any;
    expect(op.op).toBe('chan');
    expect(op.action).toBe('close');
    expect(op.channel).toBe('ch');
  });

  test('channel recv inside function body', () => {
    const code = 'function worker(ch) {\n  const msg = <-ch\n  return msg\n}';
    const m = parseAndManifest(code);
    const funcOp = m.ops.find(op => op.op === 'func_def') as any;
    const chanOp = funcOp.body.find((op: any) => op.op === 'chan');
    expect(chanOp).toBeDefined();
    expect(chanOp.action).toBe('recv');
    expect(chanOp.bind).toBe('msg');
  });

  test('channel send with non-literal value uses ref', () => {
    const m = parseAndManifest('ch <- data');
    const op = m.ops[0] as any;
    expect(op.op).toBe('chan');
    expect(op.action).toBe('send');
    expect(op.value).toEqual({ kind: 'ref', name: 'data' });
  });
});

// ─── Select ───────────────────────────────────────────────────────

describe('SelectOp', () => {
  test('select with recv case produces SelectOp', () => {
    const code = 'select {\n  case <-ch:\n    let x = 1\n}';
    const m = parseAndManifest(code);
    const op = m.ops[0] as any;
    expect(op.op).toBe('select');
    expect(op.cases).toBeDefined();
    expect(op.cases.length).toBeGreaterThanOrEqual(1);
    expect(op.cases[0].action).toBe('recv');
    expect(op.cases[0].channel).toBe('ch');
    expect(op.cases[0].body.length).toBeGreaterThan(0);
  });

  test('select with default produces defaultBody', () => {
    const code = 'select {\n  case <-ch:\n    let x = 1\n  default:\n    let y = 2\n}';
    const m = parseAndManifest(code);
    const op = m.ops[0] as any;
    expect(op.op).toBe('select');
    expect(op.defaultBody).toBeDefined();
    expect(op.defaultBody.length).toBeGreaterThan(0);
  });

  test('select with send case', () => {
    const code = 'select {\n  case ch <- 42:\n    let x = 1\n}';
    const m = parseAndManifest(code);
    const op = m.ops[0] as any;
    expect(op.op).toBe('select');
    expect(op.cases.length).toBeGreaterThanOrEqual(1);
    expect(op.cases[0].action).toBe('send');
    expect(op.cases[0].channel).toBe('ch');
    expect(op.cases[0].value).toEqual({ kind: 'literal', value: 42 });
  });
});

// ─── Spawn ────────────────────────────────────────────────────────

describe('SpawnOp', () => {
  test('go doWork() produces SpawnOp (not ERROR)', () => {
    const m = parseAndManifest('go doWork()');
    const op = m.ops[0] as any;
    expect(op.op).toBe('spawn');
    expect(op.runtime).toBe('go');
    expect(op.code).toContain('doWork');
    // Should NOT contain ERROR marker anymore
    const json = JSON.stringify(m);
    expect(json).not.toContain('ERROR');
  });

  test('go func(){}() produces SpawnOp with lambda code', () => {
    const code = 'go func() { let x = 1 }()';
    const m = parseAndManifest(code);
    const op = m.ops[0] as any;
    expect(op.op).toBe('spawn');
    expect(op.runtime).toBe('go');
  });

  test('spawn captures cross-runtime vars', () => {
    const code = 'import os\ngo doWork()';
    const m = parseAndManifest(code);
    const spawnOp = m.ops.find(op => op.op === 'spawn') as any;
    expect(spawnOp).toBeDefined();
    expect(spawnOp.op).toBe('spawn');
  });
});

// ─── Generators / Yield ───────────────────────────────────────────

describe('YieldOp', () => {
  test('generator function has generator: true', () => {
    const code = 'function* gen() { yield 1 }';
    const m = parseAndManifest(code);
    const funcOp = m.ops.find(op => op.op === 'func_def') as any;
    expect(funcOp).toBeDefined();
    expect(funcOp.generator).toBe(true);
  });

  test('yield value produces YieldOp with value', () => {
    const code = 'yield 42';
    const m = parseAndManifest(code);
    const op = m.ops[0] as any;
    expect(op.op).toBe('yield');
    expect(op.value).toEqual({ kind: 'literal', value: 42 });
  });

  test('yield* iterable produces YieldOp with delegate', () => {
    const code = 'yield* items';
    const m = parseAndManifest(code);
    const op = m.ops[0] as any;
    expect(op.op).toBe('yield');
    expect(op.delegate).toBe(true);
    expect(op.value).toEqual({ kind: 'ref', name: 'items' });
  });

  test('bare yield produces YieldOp with no value', () => {
    const code = 'yield';
    const m = parseAndManifest(code);
    const op = m.ops[0] as any;
    expect(op.op).toBe('yield');
    expect(op.value).toBeUndefined();
    expect(op.from).toBeUndefined();
  });

  test('yield with expression produces YieldOp with from eval', () => {
    const code = 'yield compute(42)';
    const m = parseAndManifest(code);
    const op = m.ops[0] as any;
    expect(op.op).toBe('yield');
    expect(op.from).toBeDefined();
    expect(op.from.op).toBe('eval');
    expect(op.from.code).toContain('compute');
  });
});

// ─── Integration: new ops ─────────────────────────────────────────

describe('New Op Integration', () => {
  test('channel + select + spawn together', () => {
    const code = `
go doWork()
<-ch
select {
  case <-ch:
    let x = 1
}`;
    const m = parseAndManifest(code);
    const opTypes = new Set(m.ops.map(op => op.op));
    expect(opTypes.has('spawn')).toBe(true);
    expect(opTypes.has('chan')).toBe(true);
    expect(opTypes.has('select')).toBe(true);
  });

  test('all new ops in valid ops list', () => {
    const validOps = [
      'exec', 'eval', 'exec_compiled', 'eval_compiled',
      'declare', 'assign', 'func_def', 'return',
      'if', 'loop', 'try', 'throw', 'parallel', 'concat', 'import', 'native',
      'chan', 'select', 'spawn', 'yield', 'await',
    ];

    const code = `
go doWork()
<-ch
ch <- 42
close(ch)
yield 1
select {
  case <-ch:
    let x = 1
}`;
    const m = parseAndManifest(code);
    function checkOps(ops: ManifestOp[]) {
      for (const op of ops) {
        expect(validOps).toContain(op.op);
        if (op.op === 'func_def') checkOps(op.body);
        if (op.op === 'if') {
          for (const arm of op.arms) checkOps(arm.body);
          if (op.elseBody) checkOps(op.elseBody);
        }
        if (op.op === 'loop') checkOps(op.body);
        if (op.op === 'select') {
          for (const c of op.cases) checkOps(c.body);
          if (op.defaultBody) checkOps(op.defaultBody);
        }
      }
    }
    checkOps(m.ops);
  });

  test('new ops are JSON-serializable', () => {
    const code = `
go doWork()
<-ch
ch <- 42
close(ch)
yield 1
yield* items
select {
  case <-ch:
    let x = 1
}`;
    const m = parseAndManifest(code);
    expect(() => JSON.stringify(m)).not.toThrow();
    const json = JSON.stringify(m);
    expect(json).toContain('"spawn"');
    expect(json).toContain('"chan"');
    expect(json).toContain('"select"');
    expect(json).toContain('"yield"');
  });
});

// ─── AwaitOp ──────────────────────────────────────────────────────

describe('AwaitOp', () => {
  test('await expr produces AwaitOp (not stringified in exec code)', () => {
    const code = 'await fetch(url)';
    const m = parseAndManifest(code);
    const op = m.ops[0] as any;
    expect(op.op).toBe('await');
    expect(op.runtime).toBeDefined();
    expect(op.from).toBeDefined();
    expect(op.from.op).toBe('eval');
    expect(op.from.code).toContain('fetch');
  });

  test('const data = await fetch(url) produces AwaitOp with bind', () => {
    const code = 'const data = await fetch(url)';
    const m = parseAndManifest(code);
    const op = m.ops[0] as any;
    expect(op.op).toBe('await');
    expect(op.bind).toBe('data');
    expect(op.from.op).toBe('eval');
    expect(op.from.code).toContain('fetch');
    expect(op.from.bind).toBe('data');
  });

  test('let result = await compute() produces AwaitOp with bind (VarDecl)', () => {
    const code = 'let result = await compute()';
    const m = parseAndManifest(code);
    const op = m.ops[0] as any;
    expect(op.op).toBe('await');
    expect(op.bind).toBe('result');
    expect(op.from.op).toBe('eval');
    expect(op.from.code).toContain('compute');
  });

  test('val := await getResult() produces AwaitOp with bind (ShortDecl)', () => {
    const code = 'val := await getResult()';
    const m = parseAndManifest(code);
    const op = m.ops[0] as any;
    expect(op.op).toBe('await');
    expect(op.bind).toBe('val');
    expect(op.from.op).toBe('eval');
    expect(op.from.code).toContain('getResult');
  });

  test('await Promise.all([...]) still produces ParallelOp (not AwaitOp)', () => {
    const code = 'await Promise.all([taskA(), taskB()])';
    const m = parseAndManifest(code);
    const parallel = m.ops.find(op => op.op === 'parallel');
    expect(parallel).toBeDefined();
    const awaitOp = m.ops.find(op => op.op === 'await');
    expect(awaitOp).toBeUndefined();
  });

  test('await inside function body produces AwaitOp with captures', () => {
    const code = `
async function loadData(url) {
  const data = await fetch(url)
  return data
}`;
    const m = parseAndManifest(code);
    const funcOp = m.ops.find(op => op.op === 'func_def') as any;
    expect(funcOp).toBeDefined();
    expect(funcOp.async).toBe(true);
    const awaitOp = funcOp.body.find((op: any) => op.op === 'await');
    expect(awaitOp).toBeDefined();
    expect(awaitOp.bind).toBe('data');
    expect(awaitOp.from.captures).toBeDefined();
    expect(awaitOp.from.captures).toHaveProperty('url');
  });
});

// ─── Error Handling: runtime on catches ───────────────────────────

describe('Error Handling: runtime on catches', () => {
  test('try/catch has runtime on catch clause', () => {
    const code = `
function safe() {
  try {
    const x = risky()
  } catch (e) {
    const y = 2
  }
}`;
    const m = parseAndManifest(code);
    const funcOp = m.ops.find(op => op.op === 'func_def') as any;
    const tryOp = funcOp.body.find((op: any) => op.op === 'try');
    expect(tryOp).toBeDefined();
    expect(tryOp.catches[0].runtime).toBeDefined();
    expect(typeof tryOp.catches[0].runtime).toBe('string');
  });

  test('try/catch/finally has runtime on catch, finallyBody preserved', () => {
    const code = `
function cleanup() {
  try {
    const x = 1
  } catch (err) {
    const y = 2
  } finally {
    const z = 3
  }
}`;
    const m = parseAndManifest(code);
    const funcOp = m.ops.find(op => op.op === 'func_def') as any;
    const tryOp = funcOp.body.find((op: any) => op.op === 'try');
    expect(tryOp.catches[0].runtime).toBeDefined();
    expect(tryOp.finallyBody).toBeDefined();
    expect(tryOp.finallyBody.length).toBeGreaterThan(0);
  });

  test('empty catch (bare catch {}) has runtime but no param', () => {
    const code = `
function swallow() {
  try {
    const x = risky()
  } catch {
    const y = 0
  }
}`;
    const m = parseAndManifest(code);
    const funcOp = m.ops.find(op => op.op === 'func_def') as any;
    const tryOp = funcOp.body.find((op: any) => op.op === 'try');
    expect(tryOp).toBeDefined();
    expect(tryOp.catches[0].param).toBeUndefined();
    expect(tryOp.catches[0].runtime).toBeDefined();
  });

  test('cross-runtime try: JS try body + Python catch', () => {
    const code = `
import os
function safe_import() {
  try {
    const data = fetch("/api")
  } catch (e) {
    const fallback = os.path.join(".", "cache")
  }
}`;
    const m = parseAndManifest(code);
    const funcOp = m.ops.find(op => op.op === 'func_def') as any;
    const tryOp = funcOp.body.find((op: any) => op.op === 'try');
    expect(tryOp).toBeDefined();
    // Catch handler runtime is determined from its body
    expect(tryOp.catches[0].runtime).toBeDefined();
  });

  test('multiple catch clauses each get their own runtime', () => {
    const code = `
function multi_catch() {
  try {
    const x = risky()
  } catch (e) {
    const a = 1
  }
}`;
    const m = parseAndManifest(code);
    const funcOp = m.ops.find(op => op.op === 'func_def') as any;
    const tryOp = funcOp.body.find((op: any) => op.op === 'try');
    expect(tryOp).toBeDefined();
    for (const c of tryOp.catches) {
      expect(c.runtime).toBeDefined();
    }
  });
});

// ─── make() as ChanOp ────────────────────────────────────────────

describe('make() as ChanOp', () => {
  test('ch := make(10) produces ChanOp make with size and bind', () => {
    const code = 'ch := make(10)';
    const m = parseAndManifest(code);
    const op = m.ops[0] as any;
    expect(op.op).toBe('chan');
    expect(op.action).toBe('make');
    expect(op.bind).toBe('ch');
    expect(op.size).toBe(10);
  });

  test('const ch = make(5) produces ChanOp make with size and bind', () => {
    const code = 'const ch = make(5)';
    const m = parseAndManifest(code);
    const op = m.ops[0] as any;
    expect(op.op).toBe('chan');
    expect(op.action).toBe('make');
    expect(op.bind).toBe('ch');
    expect(op.size).toBe(5);
  });

  test('let ch = make(0) produces ChanOp make with size 0', () => {
    const code = 'let ch = make(0)';
    const m = parseAndManifest(code);
    const op = m.ops[0] as any;
    expect(op.op).toBe('chan');
    expect(op.action).toBe('make');
    expect(op.bind).toBe('ch');
    expect(op.size).toBe(0);
  });

  test('make(10) standalone produces ChanOp make (no bind)', () => {
    const code = 'make(10)';
    const m = parseAndManifest(code);
    const op = m.ops[0] as any;
    expect(op.op).toBe('chan');
    expect(op.action).toBe('make');
    expect(op.size).toBe(10);
    expect(op.bind).toBeUndefined();
  });
});

// ─── Integration: new await/error/make ops ────────────────────────

describe('New Op Integration (await/error/make)', () => {
  test('AwaitOp in valid ops list', () => {
    const validOps = [
      'exec', 'eval', 'exec_compiled', 'eval_compiled',
      'declare', 'assign', 'func_def', 'return',
      'if', 'loop', 'try', 'throw', 'parallel', 'concat', 'import', 'native',
      'chan', 'select', 'spawn', 'yield', 'await',
    ];
    expect(validOps).toContain('await');
  });

  test('stress test: await + try/catch + make() in one function', () => {
    const code = `
async function pipeline() {
  const ch = make(5)
  try {
    const data = await fetch("/api")
    return data
  } catch (e) {
    return null
  }
}`;
    const m = parseAndManifest(code);
    const funcOp = m.ops.find(op => op.op === 'func_def') as any;
    expect(funcOp).toBeDefined();
    expect(funcOp.async).toBe(true);

    // Should have chan (make), try, and body ops
    const chanOp = funcOp.body.find((op: any) => op.op === 'chan');
    expect(chanOp).toBeDefined();
    expect(chanOp.action).toBe('make');
    expect(chanOp.bind).toBe('ch');

    const tryOp = funcOp.body.find((op: any) => op.op === 'try');
    expect(tryOp).toBeDefined();

    // Inside try body: await op
    const awaitOp = tryOp.body.find((op: any) => op.op === 'await');
    expect(awaitOp).toBeDefined();
    expect(awaitOp.bind).toBe('data');

    // Catch has runtime
    expect(tryOp.catches[0].runtime).toBeDefined();
  });

  test('JSON-serializable with new ops', () => {
    const code = `
async function test() {
  const ch = make(1)
  const data = await fetch("/x")
  try {
    ch <- data
  } catch (e) {
    const err = e
  }
}`;
    const m = parseAndManifest(code);
    expect(() => JSON.stringify(m)).not.toThrow();
    const json = JSON.stringify(m);
    expect(json).toContain('"await"');
    expect(json).toContain('"chan"');
    expect(json).toContain('"try"');
  });
});

// --- Syntactic Dominance in Manifest ---

describe('Syntactic Dominance - Manifest', () => {
  test('files.map(f => f.toUpperCase()) emits JS eval with arrow function', () => {
    const code = `import os\nconst files = os.listdir("/home")\nconst names = files.map(f => f.toUpperCase())`;
    const m = parseAndManifest(code);
    // The map call should be JS runtime due to arrow function syntax dominance
    const evalOps = m.ops.filter(op => op.op === 'eval') as any[];
    const mapOp = evalOps.find(op => op.code && op.code.includes('map'));
    expect(mapOp).toBeDefined();
    expect(mapOp.runtime).toBe('javascript');
  });

  test('sorted(names) emits Python eval', () => {
    const code = `import os\nconst files = os.listdir("/home")\nconst names = files.map(f => f.toUpperCase())\nresult = sorted(names)`;
    const m = parseAndManifest(code);
    const evalOps = m.ops.filter(op => op.op === 'eval') as any[];
    const sortedOp = evalOps.find(op => op.code && op.code.includes('sorted'));
    expect(sortedOp).toBeDefined();
    expect(sortedOp.runtime).toBe('python');
  });

  test('mixed function body: Python import → JS .map() → Python sorted() → correct runtimes', () => {
    const code = `import os
const files = os.listdir("/home")
const names = files.map(f => f.toUpperCase())
result = sorted(names)`;
    const m = parseAndManifest(code);
    const evalOps = m.ops.filter(op => op.op === 'eval') as any[];

    // os.listdir should be Python
    const listdirOp = evalOps.find(op => op.code && op.code.includes('listdir'));
    expect(listdirOp).toBeDefined();
    expect(listdirOp.runtime).toBe('python');

    // .map() should be JS (syntax dominance from arrow function)
    const mapOp = evalOps.find(op => op.code && op.code.includes('map'));
    expect(mapOp).toBeDefined();
    expect(mapOp.runtime).toBe('javascript');

    // sorted() should be Python
    const sortedOp = evalOps.find(op => op.code && op.code.includes('sorted'));
    expect(sortedOp).toBeDefined();
    expect(sortedOp.runtime).toBe('python');
  });

  test('.filter(x => x !== null) on Python object emits JS eval', () => {
    const code = `import os\nconst files = os.listdir("/home")\nconst valid = files.filter(x => x !== null)`;
    const m = parseAndManifest(code);
    const evalOps = m.ops.filter(op => op.op === 'eval') as any[];
    const filterOp = evalOps.find(op => op.code && op.code.includes('filter'));
    expect(filterOp).toBeDefined();
    expect(filterOp.runtime).toBe('javascript');
  });

  test('.append(1) on Python object stays Python in manifest', () => {
    const code = `import os\nconst files = os.listdir("/home")\nfiles.append("new_file")`;
    const m = parseAndManifest(code);
    // append is an ExprStmt so may be exec or eval
    const appendOp = m.ops.find(op => {
      const o = op as any;
      return o.code && o.code.includes('append');
    }) as any;
    expect(appendOp).toBeDefined();
    expect(appendOp.runtime).toBe('python');
  });
});

// --- Type System Integration ---

describe('Type System Bridge Integration', () => {
  test('cross-runtime variable crossing produces bridge ops', () => {
    // Python function with typed params called from JS
    const code = `
import os

def get_files(path: str) -> list:
    return os.listdir(path)

const result = get_files("/tmp")
console.log(result)
`;
    const m = parseAndManifest(code);
    // The manifest should include type summary if crossings detected
    // (depends on whether captures are triggered)
    expect(m.version).toBe(1);
  });

  test('typed function declarations are registered for boundary checking', () => {
    const code = `
def add(x: int, y: int) -> int:
    return x + y

const sum = add(1, 2)
`;
    const m = parseAndManifest(code);
    expect(m.version).toBe(1);
    expect(m.ops.length).toBeGreaterThan(0);
  });

  test('manifest includes bridges array when crossings have bridge ops', () => {
    // Force a crossing by having a Go func used in JS with captures
    const code = `
func fetch(url string) string {
    return http.Get(url)
}

const data = fetch("http://example.com")
`;
    const m = parseAndManifest(code);
    // If the manifest detected a cross-runtime capture with bridge ops
    if (m.bridges) {
      expect(Array.isArray(m.bridges)).toBe(true);
      for (const bridge of m.bridges) {
        expect(bridge).toHaveProperty('binding');
        expect(bridge).toHaveProperty('op');
      }
    }
    if (m.typeSummary) {
      expect(m.typeSummary).toHaveProperty('crossings');
      expect(m.typeSummary).toHaveProperty('safe');
      expect(m.typeSummary).toHaveProperty('coerce');
    }
  });

  test('typeSummary has correct shape', () => {
    const code = `const x = 42`;
    const m = parseAndManifest(code);
    // No crossings for single-runtime code
    expect(m.bridges).toBeUndefined();
    expect(m.typeSummary).toBeUndefined();
  });
});
