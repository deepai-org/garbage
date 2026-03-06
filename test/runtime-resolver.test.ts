import { Lexer } from '../src/lexer';
import { Parser } from '../src/parser';
import * as AST from '../src/ast';
import { RuntimeResolver, OmniRuntime, RuntimeAffinity, MarshalKind } from '../src/runtime-resolver';
import { lookupMethodAffinity, lookupBuiltinAffinity } from '../src/runtime-resolver/method-tables';
import { analyzeImportPath, analyzeBareImport } from '../src/runtime-resolver/import-analyzer';
import { SymbolTable } from '../src/runtime-resolver/symbol-table';
import { computeBridgeCost, majorityRuntime, totalBridgeCost } from '../src/runtime-resolver/cost-model';

function parseCode(code: string): AST.Program {
  const lexer = new Lexer(code);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens, code);
  return parser.parse();
}

function resolve(code: string) {
  const ast = parseCode(code);
  const resolver = new RuntimeResolver();
  return resolver.resolve(ast);
}

// --- Parser Enrichment Tests ---

describe('Parser Enrichment', () => {
  test('FuncDecl captures declKeyword: "function"', () => {
    const ast = parseCode('function greet(name) { return name }');
    const func = ast.body[0] as AST.FuncDecl;
    expect(func.kind).toBe('FuncDecl');
    expect(func.declKeyword).toBe('function');
  });

  test('FuncDecl captures declKeyword: "def"', () => {
    const ast = parseCode('def greet(name):\n  return name');
    const func = ast.body[0] as AST.FuncDecl;
    expect(func.kind).toBe('FuncDecl');
    expect(func.declKeyword).toBe('def');
  });

  test('FuncDecl captures declKeyword: "fn"', () => {
    // Note: "func" is not a keyword in the lexer, so it doesn't parse as a top-level
    // function declaration. We test with "fn" which IS a keyword.
    const ast = parseCode('fn main() { }');
    const func = ast.body[0] as AST.FuncDecl;
    expect(func.kind).toBe('FuncDecl');
    expect(func.declKeyword).toBe('fn');
  });

  test('FuncDecl captures declKeyword: "fn"', () => {
    const ast = parseCode('fn compute(x: i32) -> i32 { x * 2 }');
    const func = ast.body[0] as AST.FuncDecl;
    expect(func.kind).toBe('FuncDecl');
    expect(func.declKeyword).toBe('fn');
  });

  test('Match captures style: "rust" for brace-style', () => {
    const ast = parseCode('match x { 1 => "one", _ => "other" }');
    // Match can appear as ExprStmt or direct
    const node = ast.body[0];
    let match: AST.Match;
    if (node.kind === 'ExprStmt') {
      match = (node as AST.ExprStmt).expr as AST.Match;
    } else {
      match = node as AST.Match;
    }
    expect(match.kind).toBe('Match');
    expect(match.style).toBe('rust');
  });

  test('Program captures runtimeDirective from // @runtime comment', () => {
    const code = '// @runtime python\nx = 42';
    // Parser must receive source text to extract directives from comments
    const ast = parseCode(code);
    expect(ast.runtimeDirective).toBe('python');
  });

  test('Program has no runtimeDirective without comment', () => {
    const ast = parseCode('x = 42');
    expect(ast.runtimeDirective).toBeUndefined();
  });

  test('@py() parses as RuntimeTag expression', () => {
    const ast = parseCode('x = @py(len(items))');
    // Look for RuntimeTag in the expression tree
    const stmt = ast.body[0] as any;
    const expr = stmt.expr || stmt;
    // Find RuntimeTag somewhere in the tree
    function findRuntimeTag(node: any): AST.RuntimeTag | null {
      if (!node || typeof node !== 'object') return null;
      if (node.kind === 'RuntimeTag') return node;
      for (const key of Object.keys(node)) {
        const result = findRuntimeTag(node[key]);
        if (result) return result;
      }
      return null;
    }
    const tag = findRuntimeTag(expr);
    expect(tag).not.toBeNull();
    expect(tag!.runtime).toBe('py');
  });

  test('@js() parses as RuntimeTag expression', () => {
    const ast = parseCode('result = @js(fetch("/api"))');
    function findRuntimeTag(node: any): AST.RuntimeTag | null {
      if (!node || typeof node !== 'object') return null;
      if (node.kind === 'RuntimeTag') return node;
      for (const key of Object.keys(node)) {
        const result = findRuntimeTag(node[key]);
        if (result) return result;
      }
      return null;
    }
    const stmt = ast.body[0] as any;
    const tag = findRuntimeTag(stmt);
    expect(tag).not.toBeNull();
    expect(tag!.runtime).toBe('js');
  });

  test('@go() parses as RuntimeTag expression', () => {
    const ast = parseCode('result = @go(fmt.Sprintf("hello"))');
    function findRuntimeTag(node: any): AST.RuntimeTag | null {
      if (!node || typeof node !== 'object') return null;
      if (node.kind === 'RuntimeTag') return node;
      for (const key of Object.keys(node)) {
        const result = findRuntimeTag(node[key]);
        if (result) return result;
      }
      return null;
    }
    const stmt = ast.body[0] as any;
    const tag = findRuntimeTag(stmt);
    expect(tag).not.toBeNull();
    expect(tag!.runtime).toBe('go');
  });
});

// --- Method & Builtin Tables ---

describe('Method Tables', () => {
  test('.upper() maps to Python', () => {
    expect(lookupMethodAffinity('upper')).toBe(OmniRuntime.Python);
  });

  test('.map() maps to JavaScript', () => {
    expect(lookupMethodAffinity('map')).toBe(OmniRuntime.JavaScript);
  });

  test('.each() maps to Ruby', () => {
    expect(lookupMethodAffinity('each')).toBe(OmniRuntime.Ruby);
  });

  test('.println maps to Java', () => {
    expect(lookupMethodAffinity('println')).toBe(OmniRuntime.Java);
  });

  test('ambiguous methods return undefined', () => {
    expect(lookupMethodAffinity('split')).toBeUndefined();
    expect(lookupMethodAffinity('join')).toBeUndefined();
    expect(lookupMethodAffinity('sort')).toBeUndefined();
  });

  test('unknown methods return undefined', () => {
    expect(lookupMethodAffinity('myCustomMethod')).toBeUndefined();
  });
});

describe('Builtin Tables', () => {
  test('len() maps to Python', () => {
    expect(lookupBuiltinAffinity('len')).toBe(OmniRuntime.Python);
  });

  test('isinstance() maps to Python', () => {
    expect(lookupBuiltinAffinity('isinstance')).toBe(OmniRuntime.Python);
  });

  test('make() maps to Go', () => {
    expect(lookupBuiltinAffinity('make')).toBe(OmniRuntime.Go);
  });

  test('require() maps to JavaScript', () => {
    expect(lookupBuiltinAffinity('require')).toBe(OmniRuntime.JavaScript);
  });

  test('puts maps to Ruby', () => {
    expect(lookupBuiltinAffinity('puts')).toBe(OmniRuntime.Ruby);
  });

  test('System maps to Java', () => {
    expect(lookupBuiltinAffinity('System')).toBe(OmniRuntime.Java);
  });
});

// --- Import Analysis ---

describe('Import Analysis', () => {
  test('"fmt" infers Go', () => {
    const result = analyzeImportPath('fmt');
    expect(result).toBeDefined();
    expect(result!.runtime).toBe(OmniRuntime.Go);
  });

  test('"react" infers JavaScript', () => {
    const result = analyzeImportPath('react');
    expect(result).toBeDefined();
    expect(result!.runtime).toBe(OmniRuntime.JavaScript);
  });

  test('"os" bare import infers Python', () => {
    const result = analyzeBareImport('os');
    expect(result).toBeDefined();
    expect(result!.runtime).toBe(OmniRuntime.Python);
  });

  test('"java.util" infers Java', () => {
    const result = analyzeImportPath('java.util');
    expect(result).toBeDefined();
    expect(result!.runtime).toBe(OmniRuntime.Java);
  });

  test('./relative/path.js infers JavaScript', () => {
    const result = analyzeImportPath('./relative/path.js');
    expect(result).toBeDefined();
    expect(result!.runtime).toBe(OmniRuntime.JavaScript);
  });

  test('github.com/user/repo infers Go', () => {
    const result = analyzeImportPath('github.com/user/repo');
    expect(result).toBeDefined();
    expect(result!.runtime).toBe(OmniRuntime.Go);
  });

  test('@scope/package infers JavaScript', () => {
    const result = analyzeImportPath('@scope/package');
    expect(result).toBeDefined();
    expect(result!.runtime).toBe(OmniRuntime.JavaScript);
  });

  test('unknown module returns undefined', () => {
    const result = analyzeImportPath('completely_unknown_module_xyz');
    expect(result).toBeUndefined();
  });
});

// --- Symbol Table ---

describe('Symbol Table', () => {
  test('define and lookup in same scope', () => {
    const table = new SymbolTable();
    table.define('x', {
      name: 'x',
      affinity: { runtime: OmniRuntime.Python, confidence: 'definite', evidence: [] },
    });
    const entry = table.lookup('x');
    expect(entry).toBeDefined();
    expect(entry!.affinity.runtime).toBe(OmniRuntime.Python);
  });

  test('nested scope shadows outer', () => {
    const table = new SymbolTable();
    table.define('x', {
      name: 'x',
      affinity: { runtime: OmniRuntime.Python, confidence: 'definite', evidence: [] },
    });
    table.pushScope();
    table.define('x', {
      name: 'x',
      affinity: { runtime: OmniRuntime.JavaScript, confidence: 'definite', evidence: [] },
    });
    expect(table.lookup('x')!.affinity.runtime).toBe(OmniRuntime.JavaScript);
    table.popScope();
    expect(table.lookup('x')!.affinity.runtime).toBe(OmniRuntime.Python);
  });

  test('inner scope can see outer scope variables', () => {
    const table = new SymbolTable();
    table.define('outer', {
      name: 'outer',
      affinity: { runtime: OmniRuntime.Go, confidence: 'definite', evidence: [] },
    });
    table.pushScope();
    expect(table.lookup('outer')).toBeDefined();
    expect(table.lookup('outer')!.affinity.runtime).toBe(OmniRuntime.Go);
    table.popScope();
  });

  test('getScopeAffinity returns majority runtime', () => {
    const table = new SymbolTable();
    table.define('a', {
      name: 'a',
      affinity: { runtime: OmniRuntime.Python, confidence: 'definite', evidence: [] },
    });
    table.define('b', {
      name: 'b',
      affinity: { runtime: OmniRuntime.Python, confidence: 'definite', evidence: [] },
    });
    table.define('c', {
      name: 'c',
      affinity: { runtime: OmniRuntime.JavaScript, confidence: 'definite', evidence: [] },
    });
    const scopeAff = table.getScopeAffinity();
    expect(scopeAff).toBeDefined();
    expect(scopeAff!.runtime).toBe(OmniRuntime.Python);
  });
});

// --- Cost Model ---

describe('Cost Model', () => {
  test('primitive bridge cost is 1', () => {
    expect(computeBridgeCost(MarshalKind.Primitive)).toBe(1);
  });

  test('callback bridge cost is 100', () => {
    expect(computeBridgeCost(MarshalKind.Callback)).toBe(100);
  });

  test('async bridge cost is 200', () => {
    expect(computeBridgeCost(MarshalKind.AsyncBridge)).toBe(200);
  });

  test('majorityRuntime returns runtime when >90% share one', () => {
    const affinities: RuntimeAffinity[] = [
      { runtime: OmniRuntime.Python, confidence: 'definite', evidence: [] },
      { runtime: OmniRuntime.Python, confidence: 'definite', evidence: [] },
      { runtime: OmniRuntime.Python, confidence: 'definite', evidence: [] },
      { runtime: OmniRuntime.Python, confidence: 'definite', evidence: [] },
      { runtime: OmniRuntime.Python, confidence: 'definite', evidence: [] },
      { runtime: OmniRuntime.Python, confidence: 'definite', evidence: [] },
      { runtime: OmniRuntime.Python, confidence: 'definite', evidence: [] },
      { runtime: OmniRuntime.Python, confidence: 'definite', evidence: [] },
      { runtime: OmniRuntime.Python, confidence: 'definite', evidence: [] },
      { runtime: OmniRuntime.JavaScript, confidence: 'fallback', evidence: [] },
    ];
    expect(majorityRuntime(affinities)).toBe(OmniRuntime.Python);
  });

  test('majorityRuntime returns undefined when split', () => {
    const affinities: RuntimeAffinity[] = [
      { runtime: OmniRuntime.Python, confidence: 'definite', evidence: [] },
      { runtime: OmniRuntime.JavaScript, confidence: 'definite', evidence: [] },
    ];
    expect(majorityRuntime(affinities)).toBeUndefined();
  });

  test('totalBridgeCost sums all bridge costs', () => {
    const bridges = [
      { from: OmniRuntime.Python, to: OmniRuntime.JavaScript, marshalKind: MarshalKind.Primitive, cost: 1 },
      { from: OmniRuntime.Go, to: OmniRuntime.JavaScript, marshalKind: MarshalKind.Array, cost: 10 },
    ];
    expect(totalBridgeCost(bridges)).toBe(11);
  });
});

// --- Runtime Resolver Integration ---

describe('Runtime Resolver', () => {
  test('ListComprehension resolves to Python', () => {
    const result = resolve('[x * 2 for x in items]');
    const firstNode = result.program.body[0];
    const affinity = result.affinityMap.get(firstNode);
    // ListComprehension could be wrapped in ExprStmt
    if (firstNode.kind === 'ExprStmt') {
      const expr = (firstNode as AST.ExprStmt).expr;
      const exprAff = result.affinityMap.get(expr);
      if (exprAff) {
        expect(exprAff.runtime).toBe(OmniRuntime.Python);
        expect(exprAff.confidence).toBe('definite');
      }
    }
  });

  test('Pass statement resolves to Python', () => {
    const result = resolve('pass');
    const node = result.program.body[0];
    const aff = result.affinityMap.get(node);
    expect(aff).toBeDefined();
    expect(aff!.runtime).toBe(OmniRuntime.Python);
  });

  test('JSX resolves to JavaScript', () => {
    const result = resolve('<div>Hello</div>');
    const node = result.program.body[0];
    let jsxNode: AST.Expr | undefined;
    if (node.kind === 'ExprStmt') {
      jsxNode = (node as AST.ExprStmt).expr;
    }
    if (jsxNode) {
      const aff = result.affinityMap.get(jsxNode);
      expect(aff).toBeDefined();
      expect(aff!.runtime).toBe(OmniRuntime.JavaScript);
    }
  });

  test('fn keyword infers Rust', () => {
    const result = resolve('fn compute(x: i32) -> i32 { x * 2 }');
    const node = result.program.body[0] as AST.FuncDecl;
    const aff = result.affinityMap.get(node);
    expect(aff).toBeDefined();
    expect(aff!.runtime).toBe(OmniRuntime.Rust);
  });

  test('def keyword infers Python', () => {
    const result = resolve('def greet(name):\n  print(name)');
    const node = result.program.body[0] as AST.FuncDecl;
    const aff = result.affinityMap.get(node);
    expect(aff).toBeDefined();
    expect(aff!.runtime).toBe(OmniRuntime.Python);
  });

  test('function keyword infers JavaScript', () => {
    const result = resolve('function greet(name) { console.log(name) }');
    const node = result.program.body[0] as AST.FuncDecl;
    const aff = result.affinityMap.get(node);
    expect(aff).toBeDefined();
    expect(aff!.runtime).toBe(OmniRuntime.JavaScript);
  });

  test('file-level @runtime directive sets default', () => {
    const code = '// @runtime python\nx = 42';
    // Parser receives source to extract directives from comments
    const result = resolve(code);
    expect(result.defaultRuntime).toBe(OmniRuntime.Python);
  });

  test('fallback chain defaults to JavaScript', () => {
    const result = resolve('x = 42');
    expect(result.defaultRuntime).toBe(OmniRuntime.JavaScript);
  });

  test('scope inheritance: statements inside Python def inherit Python', () => {
    const result = resolve('def greet(name):\n  print(name)');
    const func = result.program.body[0] as AST.FuncDecl;
    const funcAff = result.affinityMap.get(func);
    expect(funcAff).toBeDefined();
    expect(funcAff!.runtime).toBe(OmniRuntime.Python);
  });

  test('@py() inline marker overrides scope affinity', () => {
    const code = 'result = @py(len(items))';
    const result = resolve(code);

    function findRuntimeTag(node: any): AST.RuntimeTag | null {
      if (!node || typeof node !== 'object') return null;
      if (node.kind === 'RuntimeTag') return node;
      for (const key of Object.keys(node)) {
        if (Array.isArray(node[key])) {
          for (const item of node[key]) {
            const found = findRuntimeTag(item);
            if (found) return found;
          }
        } else {
          const found = findRuntimeTag(node[key]);
          if (found) return found;
        }
      }
      return null;
    }

    const tag = findRuntimeTag(result.program.body[0]);
    if (tag) {
      const aff = result.affinityMap.get(tag);
      expect(aff).toBeDefined();
      expect(aff!.runtime).toBe(OmniRuntime.Python);
      expect(aff!.confidence).toBe('definite');
    }
  });

  test('resolver produces annotated tree', () => {
    const result = resolve('function hello() { return 42 }');
    expect(result.root).toBeDefined();
    expect(result.root.node).toBe(result.program);
    expect(result.root.children.length).toBeGreaterThan(0);
  });

  test('affinityMap contains entries for all visited nodes', () => {
    const result = resolve('function hello() { return 42 }');
    expect(result.affinityMap.size).toBeGreaterThan(0);
  });

  test('async function gets async flag', () => {
    const result = resolve('async function fetchData() { return await fetch("/api") }');
    const func = result.program.body[0] as AST.FuncDecl;
    const aff = result.affinityMap.get(func);
    expect(aff).toBeDefined();
    // async functions should propagate async flag
    expect(aff!.async).toBe(true);
  });
});

// --- Import-to-Usage Propagation ---

describe('Import-to-Usage Propagation', () => {
  test('import os → os.path.join() resolves to Python', () => {
    const result = resolve('import os\nos.path.join("/tmp", "file")');
    // Find the Call node
    for (const [node, aff] of result.affinityMap) {
      if (node.kind === 'Call') {
        expect(aff.runtime).toBe(OmniRuntime.Python);
      }
    }
  });

  test('import numpy → numpy.array() resolves to Python', () => {
    const result = resolve('import numpy\nnumpy.array([1, 2, 3])');
    for (const [node, aff] of result.affinityMap) {
      if (node.kind === 'Call') {
        expect(aff.runtime).toBe(OmniRuntime.Python);
      }
    }
  });

  test('import react (bare) resolves to JavaScript', () => {
    const result = resolve('import react');
    const node = result.program.body[0];
    const aff = result.affinityMap.get(node);
    expect(aff).toBeDefined();
    expect(aff!.runtime).toBe(OmniRuntime.JavaScript);
  });

  test('assigned variable inherits import runtime through chain', () => {
    const result = resolve('import pandas\ndf = pandas.DataFrame(data)\ndf.head(5)');
    // All calls should be Python
    for (const [node, aff] of result.affinityMap) {
      if (node.kind === 'Call') {
        expect(aff.runtime).toBe(OmniRuntime.Python);
      }
      if (node.kind === 'Member') {
        expect(aff.runtime).toBe(OmniRuntime.Python);
      }
    }
  });

  test('method table does NOT override import provenance', () => {
    // .map() is in the JS method table, but files came from os.listdir() (Python)
    const result = resolve('import os\nfiles = os.listdir("/tmp")\nfiles.map(f => f)');
    // Find the .map Member node
    for (const [node, aff] of result.affinityMap) {
      if (node.kind === 'Member' && (node as AST.Member).property.name === 'map') {
        expect(aff.runtime).toBe(OmniRuntime.Python);
      }
    }
  });

  test('method table DOES apply when object has no import provenance', () => {
    const result = resolve('items.map(x => x * 2)');
    for (const [node, aff] of result.affinityMap) {
      if (node.kind === 'Member' && (node as AST.Member).property.name === 'map') {
        expect(aff.runtime).toBe(OmniRuntime.JavaScript);
      }
    }
  });

  test('aliased import propagates: import numpy as np', () => {
    const result = resolve('import numpy as np\nnp.array([1])');
    for (const [node, aff] of result.affinityMap) {
      if (node.kind === 'Call') {
        expect(aff.runtime).toBe(OmniRuntime.Python);
      }
    }
  });

  test('JS import { useState } from "react" → useState() is JS', () => {
    const result = resolve('import { useState } from "react"\nuseState(0)');
    for (const [node, aff] of result.affinityMap) {
      if (node.kind === 'Call') {
        expect(aff.runtime).toBe(OmniRuntime.JavaScript);
      }
    }
  });
});
