/**
 * Dispatch Manifest types for OmniVM.
 *
 * The manifest is a structured JSON IR that OmniVM interprets directly.
 * No language is "on top" — JS, Python, Ruby, Java are all equal runtimes.
 * The manifest describes what code to run, in which runtime, and how data
 * flows between runtimes via named bindings.
 *
 * Design decisions informed by OmniVM team feedback:
 * - No generic `async` flag on individual ops (async is runtime-specific)
 * - Compiled targets (Rust/C) are aspirational/P3
 * - Go is scoped to pre-compiled registered functions, not arbitrary code
 * - Callbacks stay explicit (no transparent foreign function wrapping)
 * - `parallel` uses cooperative concurrency, not true thread parallelism
 */

// ─── Top-Level Manifest ───────────────────────────────────────────

export interface DispatchManifest {
  /** Format version for forward compatibility. */
  version: 1;
  /** Default runtime resolved from `// @runtime` directive or fallback. */
  defaultRuntime: string;
  /** Ordered list of top-level operations. */
  ops: ManifestOp[];
  /** Source file path (for error messages / debug). */
  source?: string;
}

// ─── Op Union ─────────────────────────────────────────────────────

export type ManifestOp =
  | ExecOp
  | EvalOp
  | ExecCompiledOp
  | EvalCompiledOp
  | DeclareOp
  | AssignOp
  | FuncDefOp
  | ReturnOp
  | IfOp
  | LoopOp
  | ParallelOp
  | ConcatOp
  | ImportOp
  | NativeOp;

// ─── Core Runtime Dispatch ────────────────────────────────────────

/**
 * Execute code in a runtime, discard result.
 * Maps to OmniVM's runtime.Execute(code).
 *
 * For Go runtime: use `func` + `args` instead of `code` (pre-registered functions only).
 */
export interface ExecOp {
  op: "exec";
  runtime: string;
  code?: string;
  /** Pre-registered function name (Go runtime). */
  func?: string;
  /** Arguments for pre-registered function call. */
  args?: string[];
  captures?: CaptureMap;
}

/**
 * Execute code in a runtime, bind result to a name.
 * Maps to OmniVM's runtime.Eval(code) → stored in binding table.
 *
 * For Go runtime: use `func` + `args` instead of `code` (pre-registered functions only).
 */
export interface EvalOp {
  op: "eval";
  runtime: string;
  code?: string;
  /** Pre-registered function name (Go runtime). */
  func?: string;
  /** Arguments for pre-registered function call. */
  args?: string[];
  bind: string;
  captures?: CaptureMap;
}

// ─── Compiled Targets (Rust, C) — Aspirational/P3 ────────────────
// Per OmniVM team: compiling arbitrary Rust/C at runtime is a major
// security and complexity surface. These ops are defined for forward
// compatibility but are not expected in the initial implementation.

/** Compile and execute code, discard result. (Aspirational) */
export interface ExecCompiledOp {
  op: "exec_compiled";
  lang: string;
  code: string;
}

/** Compile and execute code, bind result. (Aspirational) */
export interface EvalCompiledOp {
  op: "eval_compiled";
  lang: string;
  code: string;
  bind: string;
}

// ─── Variable Management ──────────────────────────────────────────

/** Declare a named variable in manifest scope. */
export interface DeclareOp {
  op: "declare";
  bind: string;
  mutable: boolean;
  value?: ManifestValue;
  from?: EvalOp | EvalCompiledOp | NativeOp;
}

/** Reassign an existing binding. */
export interface AssignOp {
  op: "assign";
  target: string;
  operator: string;
  value?: ManifestValue;
  from?: EvalOp | EvalCompiledOp | NativeOp;
}

// ─── Functions ────────────────────────────────────────────────────

/**
 * Define a callable function with a (possibly polyglot) body.
 * OmniVM stores this as a closure (body ops + captured scope) in
 * the binding table.
 *
 * When `async` is true, the function returns a promise-like handle.
 * OmniVM pumps the event loops of all involved runtimes until all
 * body ops complete. The caller receives the resolved value.
 *
 * For compiled targets (Go): `source` contains a complete compilation
 * unit (package, imports, types, functions) and `exports` lists the
 * Go symbol names that plugin.Lookup should find. OmniVM compiles
 * the source and registers the exported functions. The `name` field
 * is the PolyScript-level name; OmniVM maps it to the exported symbol.
 */
export interface FuncDefOp {
  op: "func_def";
  name: string;
  params: ParamDef[];
  body: ManifestOp[];
  generator?: boolean;
  async?: boolean;
  /** If set, entire body runs in this single runtime. */
  bodyRuntime?: string;
  /** Complete source compilation unit (Go). OmniVM compiles at load time. */
  source?: string;
  /** Exported symbol names for plugin.Lookup (Go visibility rules). */
  exports?: string[];
  /** External symbols the plugin needs injected (package-level vars set by OmniVM). */
  requires?: string[];
}

export interface ParamDef {
  name: string;
  spread?: boolean;
  defaultValue?: ManifestValue;
}

// ─── Control Flow ─────────────────────────────────────────────────

/**
 * Return a value from a function.
 * OmniVM uses a sentinel value to unwind the op stack.
 */
export interface ReturnOp {
  op: "return";
  value?: ManifestValue;
  from?: EvalOp | EvalCompiledOp | NativeOp;
}

/** Conditional branching. */
export interface IfOp {
  op: "if";
  arms: IfArm[];
  elseBody?: ManifestOp[];
}

export interface IfArm {
  test: ConditionExpr;
  body: ManifestOp[];
}

/** Loop construct. */
export interface LoopOp {
  op: "loop";
  mode: "while" | "for" | "infinite" | "foreach";
  test?: ConditionExpr;
  variable?: string;
  iterable?: ManifestValue;
  body: ManifestOp[];
}

// ─── Concurrency ─────────────────────────────────────────────────
//
// Per OmniVM team: `parallel` uses cooperative concurrency, not true
// thread parallelism. Async-capable runtimes (Python asyncio, JS Promises)
// are started in one pump cycle, then the dispatcher interleaves them.
// Synchronous runtimes (Ruby, Java) run sequentially within a parallel op.

/** Run multiple operations across runtimes with cooperative concurrency. */
export interface ParallelOp {
  op: "parallel";
  branches: ParallelBranch[];
}

export interface ParallelBranch {
  runtime: string;
  code: string;
  bind: string;
  captures?: CaptureMap;
}

// ─── String Interpolation ─────────────────────────────────────────

/** Polyglot string interpolation — concatenate segments from multiple runtimes. */
export interface ConcatOp {
  op: "concat";
  bind: string;
  segments: ConcatSegment[];
}

export type ConcatSegment =
  | { kind: "text"; value: string }
  | { kind: "ref"; name: string }
  | { kind: "eval"; runtime: string; code: string; captures?: CaptureMap };

// ─── Imports ──────────────────────────────────────────────────────

/** Import a module in a specific runtime. */
export interface ImportOp {
  op: "import";
  path: string;
  runtime: string;
  bind?: string;
  names?: string[];
  specifiers?: ImportSpecifier[];
  defaultImport?: string;
  namespaceImport?: string;
}

export interface ImportSpecifier {
  imported: string;
  local: string;
}

// ─── Native Pass-Through ──────────────────────────────────────────

/** Execute code natively in its runtime (no bridge overhead). */
export interface NativeOp {
  op: "native";
  runtime: string;
  code: string;
  bind?: string;
}

// ─── Shared Types ─────────────────────────────────────────────────

/**
 * Map of variable names to inject into a target runtime.
 * Keys = names in the target runtime, values = binding names in manifest scope.
 *
 * OmniVM implements this per-runtime:
 * - Python: PyObject_SetAttrString on __main__ (or locals dict with exec())
 * - JS: globalThis.varName = value (or IIFE locals for scope isolation)
 * - Ruby: global $varName or binding.eval
 * - Java: OmniVMRunner constructor args
 */
export type CaptureMap = Record<string, string>;

/** A value in manifest scope: either a literal or a reference to a binding. */
export type ManifestValue =
  | { kind: "literal"; value: unknown }
  | { kind: "ref"; name: string };

/** A condition for if/while: reference, literal, or runtime eval. */
export type ConditionExpr =
  | { kind: "ref"; name: string }
  | { kind: "literal"; value: unknown }
  | { kind: "expr"; runtime: string; code: string; captures?: CaptureMap };
