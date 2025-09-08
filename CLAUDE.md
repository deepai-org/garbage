# Claude Development Guidelines

## Project Overview
PolyScript is a universal parser that handles multiple programming language syntaxes in a single file.

## Current Status
- **402/402 tests passing (100% pass rate!)**
- Complete type parsing and multi-paradigm support
- Rust-style syntax fully supported (::, async move, .await, ? try operator)
- Match statements with multiple arms working correctly
- Deep nested generic types (15+ levels tested) parsing successfully
- JSX with generic type arguments fully implemented per spec
- Type assertions (`<Type>expr`) correctly disambiguated from JSX
- List comprehensions with multiple target variables
- **ALL DATA DISCARD ISSUES RESOLVED** - Parser now stores complete AST

### Complete AST Data Recovery ✅
All previously discarded syntax elements are now properly stored:

#### Import/Export Data
- ✅ ImportDecl AST type with full destructured import support
- ✅ Export default declarations properly stored with isDefault flag
- ✅ Export specifiers with renaming support

#### Decorators & Annotations
- ✅ Decorator support for functions, parameters, and class members
- ✅ Decorator arguments properly parsed and stored
- ✅ Multiple decorators per element supported

#### Type System
- ✅ ObjectType for object type literals with modifiers
- ✅ Interface method signatures with full parameter info
- ✅ Function type parameter names (not just types)
- ✅ Optional parameters in function types

#### Advanced Expressions
- ✅ Computed object properties storing actual expressions
- ✅ List comprehensions with multiple target variables

#### Destructuring & Patterns
- ✅ Destructuring patterns in parameters (ArrayPattern, ObjectPattern)
- ✅ Nested destructuring patterns fully supported
- ✅ Rest/spread patterns in destructuring

#### Class Members & Accessors
- ✅ Method signatures in classes (without implementation)
- ✅ TypeScript-style getters and setters
- ✅ C# property accessor bodies (get/set blocks)
- ✅ Property accessor visibility modifiers
- ✅ Auto-properties and properties with bodies

#### Rust-style Impl Blocks
- ✅ Where clauses in impl blocks fully parsed and stored
- ✅ Associated types and constants in impl blocks
- ✅ Const functions (const fn) properly recognized
- ✅ Unknown impl members preserved as Unknown type
- ✅ Visibility modifiers for all impl members

#### Short Declarations
- ✅ Destructuring patterns in short declarations (:=)
- ✅ Mixed destructuring (identifiers + patterns)
- ✅ Multiple targets with single value

### Remaining Data Discard Issues (Found on deeper inspection)

While the major data discard issues have been resolved, some remain:

1. **Where clauses in impl blocks** (line ~5951)
   - Entire where clause is skipped after `where` keyword
   - Should parse and store type constraints

2. **Unknown impl members** (line ~5986)
   - Unknown member types in impl blocks are skipped
   - Should at least store as generic AST nodes

3. **Destructuring patterns in short declarations** (line ~2470)
   - Complex destructuring in Go-style short declarations is skipped
   - Creates placeholder instead of parsing pattern structure

4. **Some error recovery paths**
   - Various error recovery paths discard partial parse results
   - Should preserve what was successfully parsed

Most of the parser now provides complete AST representation, but these edge cases still need attention.

## Quick Debugging Commands
```bash
npm test                # Run all tests
npm run build          # Build TypeScript
node test-*.js         # Run specific debug test
```

## Creating Debug Tests
When a test fails, immediately create a minimal test file:
```javascript
const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

const code = `[failing code here]`;
const lexer = new Lexer(code);
const tokens = lexer.tokenize();
const parser = new Parser(tokens);
const ast = parser.parse();
console.log('AST nodes:', ast.body.length);
```

## Key Parser Issues & Solutions

### Virtual Semicolons
- Skip them in pattern matching: `while (this.peek().virtualSemi) this.advance()`
- They're auto-inserted by lexer, handle carefully

### Infinite Loops
- Always ensure loops either consume a token or break
- Add safeguards: `if (this.current === beforePos) this.advance()`

### Context-Dependent Tokens
- `<` can be comparison, generic start, JSX element, or type assertion
  - Use `couldBeTypeAssertion()` for disambiguation
  - Check for closing tags to confirm JSX vs type assertion
  - Look for JSX attributes vs expression continuations
- `:` can be type annotation, case separator, or Python block start
- `.` triggers MemberAccess mode where keywords become identifiers

### Parser Structure
- Main flow: `parse()` → `parseTopLevel()` → `parseStatement()` or `parseDeclaration()`
- Function bodies use `parseBlock()`, not `parseTopLevel()`
- `braceDepth` tracks nesting for proper `}` handling

## Lexer Mode Stack
The lexer has 5 modes that change tokenization behavior:

1. **Normal** - Default mode
2. **MemberAccess** - After `.`, keywords → identifiers
3. **BashCondition** - Inside `[ ]` for bash tests
4. **Decorator** - After `@`, keywords → identifiers  
5. **StringTemplate** - For special string literals

## Recently Fixed Issues

### Rust Type System Support
- Added `DynType` for trait objects (`dyn Trait`)
- Handle associated type constraints in generics (`Item = V`)
- Fixed tuple type parsing `(T, U)` in nested generics

### Function Declaration Improvements  
- Fixed `fn` with return type arrow (`->`) being parsed as lambda
- Proper handling of complex nested generic signatures

### Class Declaration Enhancements
- Added support for `with` clause for mixins/traits
- Fixed decorator parsing with complex inheritance chains
- Improved generic parameter handling

### Ruby Block Support
- Added `do...end` block parsing after method calls
- Fixed `def...end` function parsing with proper nesting

### JSX/TSX Complete Support
- Full JSXGenericElement implementation (`<Table<RowData<string>>>`)
- Type assertion vs JSX disambiguation with smart lookahead
- Handles deeply nested generic types in JSX components
- JSX fragments with generic components working correctly
- Expression containers `{expr}` properly parsed in all contexts

### Deep Generic Nesting
- Token splitting for `>>` and `>>>` operators
- Supports arbitrary nesting depth (tested to 15+ levels)
- Correctly handles mixed generics with shift operators
- Fixed test expectations for complex multi-argument cases

## Achievement: 100% Test Pass Rate
All 391 tests are now passing. The parser is fully compliant with the PolyScript specification.

## Missing AST Data Storage - Implementation Plan

### Problem
The parser currently consumes but doesn't store many syntax elements, often with "for now" comments. This means valid code is parsed but critical information is lost.

### Critical Issues to Fix

#### Phase 1: Import/Export Data ✅ COMPLETED
1. **Destructured Imports** ✅ - Store import specifiers
   - `import { foo, bar as baz } from 'module'`
   - Added ImportDecl AST type with specifiers array
   
2. **Default Exports** ✅ - Store the exported value
   - `export default class MyClass {}`
   - Added isDefault flag and stores declaration
   
3. **Destructured Exports** ✅ - Store export specifiers  
   - `export { foo, bar } from 'module'`
   - Already working - ExportSpecifier array stores names

#### Phase 2: Decorators ✅ COMPLETED
4. **Function Decorators** ✅ - Add decorator field to FuncDecl
   - `@decorator function foo() {}`
   - Decorators array added to FuncDecl AST
   
5. **Parameter Decorators** ✅ - Add decorators to Param
   - `function foo(@NotNull param: string)`
   - Decorators array added to Param AST
   
6. **Class Member Decorators** ✅ - Add decorators to ClassMember
   - `class Foo { @Input prop: string }`
   - Decorators array added to ClassMember AST

#### Phase 3: Type System  
8. **Object Type Literals** ✅ - Parse full structure
   - `type Obj = { x: number, y: string }`
   - Added ObjectType and ObjectTypeProperty to AST
   - Supports optional and readonly modifiers
   
9. **Method Types in Interfaces** - Store method signatures (IN PROGRESS)
   - `interface I { method(param: string): number }`
   
7. **Where Clauses** - Store type constraints (DEFERRED - Rust-specific)
   - `impl<T> MyTrait for T where T: Clone {}`

#### Phase 4: Advanced Expressions
10. **Computed Object Properties** ✅ - Store computed keys properly
    - `{ [key]: value }`
    - Computed properties now store the full expression as the key
    - Computed flag properly set on ObjectProperty
    
11. **List Comprehensions** - Create proper AST node
    - `[x * 2 for x in range(10)]`

### Testing Strategy

1. **Create failing tests first** - Write tests that verify the data is stored
2. **Test-driven fixes** - Fix parser only after test is written
3. **Verify no regressions** - Ensure all 391 existing tests still pass

### Implementation Order

1. Start with import/export (most fundamental)
2. Add decorator support (widely used)
3. Enhance type system (important for TypeScript)
4. Handle advanced expressions (less common)

Each fix should:
- Remove the "for now" comment
- Store the parsed data in appropriate AST field
- Pass the new test
- Not break existing tests

## Detailed Implementation Plans

See these documents for comprehensive implementation details:
- **FULL-COMPATIBILITY-PLAN.md** - Complete 3-week roadmap
- **VIRTUAL-SEMICOLON-FIX.md** - Step-by-step lexer fix guide
- **COMPATIBILITY-ROADMAP.md** - Prioritized quick wins

## Debug Workflow
1. **Isolate** - Extract failing code from test
2. **Simplify** - Reduce to minimal case
3. **Inspect** - Check tokens with: `tokens.forEach(t => console.log(t))`
4. **Trace** - Add logging to suspicious parser methods
5. **Fix** - Make minimal change
6. **Verify** - Test variations before running full suite