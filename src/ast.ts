export interface Span {
  start: number;
  end: number;
  line: number;
  column: number;
}

// Type nodes
export type TypeNode =
  | SimpleType
  | NullableType
  | UnionType
  | GenericType
  | FuncType
  | ChanType;

export interface SimpleType {
  kind: "SimpleType";
  id: Identifier;
  span: Span;
}

export interface NullableType {
  kind: "NullableType";
  inner: TypeNode;
  span: Span;
}

export interface UnionType {
  kind: "UnionType";
  types: TypeNode[];
  span: Span;
}

export interface GenericType {
  kind: "GenericType";
  base: Identifier;
  args: TypeNode[];
  span: Span;
}

export interface FuncType {
  kind: "FuncType";
  params: TypeNode[];
  ret: TypeNode;
  span: Span;
}

export interface ChanType {
  kind: "ChanType";
  direction: "send" | "receive" | "both";
  elementType?: TypeNode;
  span: Span;
}

// Expression nodes
export type Expr =
  | NumericLiteral
  | StringLiteral
  | RegexLiteral
  | BooleanLiteral
  | NullLiteral
  | Identifier
  | Call
  | Index
  | Member
  | Unary
  | Binary
  | Assign
  | Lambda
  | Ternary
  | ArrayLiteral
  | SetLiteral
  | ObjectLiteral
  | Spread
  | Yield;

export interface NumericLiteral {
  kind: "NumericLiteral";
  raw: string;
  base: "decimal" | "hex" | "octal" | "binary";
  suffix?: string;
  span: Span;
}

export interface StringLiteral {
  kind: "StringLiteral";
  parts: StringPart[];
  flags: {
    raw?: boolean;
    bytes?: boolean;
    format?: boolean;
    const?: boolean;
  };
  delimiter: string;
  span: Span;
}

export interface StringPart {
  kind: "Text" | "Interpolation";
  value: string | Expr;
}

export interface RegexLiteral {
  kind: "RegexLiteral";
  pattern: string;
  flags: string;
  span: Span;
}

export interface BooleanLiteral {
  kind: "BooleanLiteral";
  value: boolean;
  span: Span;
}

export interface NullLiteral {
  kind: "NullLiteral";
  span: Span;
}

export interface Identifier {
  kind: "Identifier";
  name: string;
  originalSpelling?: string; // For $foo or `backtick` identifiers
  span: Span;
}

export interface Call {
  kind: "Call";
  callee: Expr;
  args: Expr[];
  span: Span;
}

export interface Index {
  kind: "Index";
  object: Expr;
  index: Expr;
  span: Span;
}

export interface Member {
  kind: "Member";
  object: Expr;
  property: Identifier;
  optional?: boolean;
  computed?: boolean;
  span: Span;
}

export interface Unary {
  kind: "Unary";
  op: string;
  argument: Expr;
  prefix: boolean;
  span: Span;
}

export interface Binary {
  kind: "Binary";
  op: string;
  left: Expr;
  right: Expr;
  span: Span;
}

export interface Assign {
  kind: "Assign";
  op: string;
  left: Expr;
  right: Expr;
  span: Span;
}

export interface Lambda {
  kind: "Lambda";
  params: Param[];
  returnType?: TypeNode;
  body: Block | Expr;
  async?: boolean;
  unsafe?: boolean;
  span: Span;
}

export interface Ternary {
  kind: "Ternary";
  test: Expr;
  consequent: Expr;
  alternate: Expr;
  span: Span;
}

export interface ArrayLiteral {
  kind: "ArrayLiteral";
  elements: Expr[];
  span: Span;
}

export interface SetLiteral {
  kind: "SetLiteral";
  elements: Expr[];
  span: Span;
}

export interface ObjectLiteral {
  kind: "ObjectLiteral";
  properties: ObjectProperty[];
  span: Span;
}

export interface ObjectProperty {
  key: Identifier | StringLiteral | NumericLiteral;
  value: Expr;
  shorthand?: boolean;
  computed?: boolean;
  span: Span;
}

export interface Spread {
  kind: "Spread";
  argument: Expr;
  optional?: boolean;
  span: Span;
}

// Statement nodes
export type Stmt =
  | ExprStmt
  | If
  | Loop
  | Switch
  | Try
  | Using
  | Defer
  | Break
  | Continue
  | Return
  | Echo
  | Block
  | Throw
  | Yield
  | Go
  | Pass;

export interface ExprStmt {
  kind: "ExprStmt";
  expr: Expr;
  span: Span;
}

export interface If {
  kind: "If";
  arms: IfArm[];
  elseBody?: Block;
  span: Span;
}

export interface IfArm {
  test: Expr;
  body: Block;
  span: Span;
}

export interface Loop {
  kind: "Loop";
  mode: "for" | "while" | "until" | "foreach" | "infinite";
  init?: Stmt | Decl;
  test?: Expr;
  step?: Expr;
  iterable?: Expr;
  variable?: Identifier;
  body: Block;
  label?: Identifier;
  await?: boolean;
  span: Span;
}

export interface Switch {
  kind: "Switch";
  discriminant: Expr;
  cases: SwitchCase[];
  defaultCase?: Block;
  span: Span;
}

export interface SwitchCase {
  patterns: Expr[];
  guard?: Expr;  // Guard clause for pattern matching (if condition)
  body: Block;
  fallthrough?: boolean;
  span: Span;
}

export interface Try {
  kind: "Try";
  body: Block;
  catches: CatchClause[];
  finallyBody?: Block;
  span: Span;
}

export interface CatchClause {
  param?: Identifier;
  type?: TypeNode;
  body: Block;
  span: Span;
}

export interface Using {
  kind: "Using";
  resource: Expr | Decl;
  body: Block;
  span: Span;
}

export interface Defer {
  kind: "Defer";
  body: Block | Expr;
  span: Span;
}

export interface Break {
  kind: "Break";
  label?: Identifier;
  span: Span;
}

export interface Continue {
  kind: "Continue";
  label?: Identifier;
  span: Span;
}

export interface Return {
  kind: "Return";
  values: Expr[];
  span: Span;
}

export interface Echo {
  kind: "Echo";
  values: Expr[];
  span: Span;
}

export interface Throw {
  kind: "Throw";
  value: Expr;
  span: Span;
}

export interface Yield {
  kind: "Yield";
  value?: Expr;
  delegate?: boolean; // for yield*
  span: Span;
}

export interface Go {
  kind: "Go";
  expr: Expr;
  span: Span;
}

export interface Pass {
  kind: "Pass";
  span: Span;
}

// Declaration nodes
export type Decl =
  | Import
  | VarDecl
  | ConstDecl
  | ShortDecl
  | Reassign
  | FuncDecl
  | TypeDecl
  | ClassDecl
  | InterfaceDecl
  | EnumDecl
  | PackageDecl
  | ExportDecl;

export interface Import {
  kind: "Import";
  path: string;
  alias?: Identifier;
  span: Span;
}

export interface VarDecl {
  kind: "VarDecl";
  names: Identifier[];
  type?: TypeNode;
  values?: Expr[];
  span: Span;
}

export interface ConstDecl {
  kind: "ConstDecl";
  names: Identifier[];
  type?: TypeNode;
  values: Expr[];
  span: Span;
}

export interface ShortDecl {
  kind: "ShortDecl";
  pairs: ShortDeclPair[];
  span: Span;
}

export interface ShortDeclPair {
  name: Identifier;
  expr: Expr;
}

export interface Reassign {
  kind: "Reassign";
  name: Identifier;
  expr: Expr;
  span: Span;
}

export interface FuncDecl {
  kind: "FuncDecl";
  name: Identifier;
  params: Param[];
  returnType?: TypeNode;
  async?: boolean;
  unsafe?: boolean;
  generator?: boolean;
  body: Block;
  span: Span;
}

export interface Param {
  name: Identifier;
  type?: TypeNode;
  defaultValue?: Expr;
  span: Span;
}

export interface TypeDecl {
  kind: "TypeDecl";
  name: Identifier;
  definition: TypeNode;
  span: Span;
}

export interface ClassDecl {
  kind: "ClassDecl";
  name: Identifier;
  typeParams?: Identifier[];
  extends?: TypeNode;
  implements?: TypeNode[];
  members: ClassMember[];
  span: Span;
}

export interface ClassMember {
  kind: "Field" | "Method" | "Constructor";
  name?: Identifier;
  visibility?: "public" | "private" | "protected";
  static?: boolean;
  readonly?: boolean;
  type?: TypeNode;
  params?: Param[];
  body?: Block;
  span: Span;
}

export interface InterfaceDecl {
  kind: "InterfaceDecl";
  name: Identifier;
  typeParams?: Identifier[];
  extends?: TypeNode[];
  members: InterfaceMember[];
  span: Span;
}

export interface InterfaceMember {
  name: Identifier;
  type: TypeNode;
  optional?: boolean;
  span: Span;
}

export interface EnumDecl {
  kind: "EnumDecl";
  name: Identifier;
  members: EnumMember[];
  span: Span;
}

export interface EnumMember {
  name: Identifier;
  value?: Expr;
  span: Span;
}

export interface PackageDecl {
  kind: "PackageDecl";
  name: string;
  span: Span;
}

export interface ExportDecl {
  kind: "ExportDecl";
  declaration?: Decl;
  specifiers?: ExportSpecifier[];
  source?: string;
  span: Span;
}

export interface ExportSpecifier {
  local: Identifier;
  exported?: Identifier;
  span: Span;
}

// Block node
export interface Block {
  kind: "Block";
  statements: (Decl | Stmt)[];
  span: Span;
}

// Program root
export interface Program {
  kind: "Program";
  body: (Decl | Stmt)[];
  span: Span;
}