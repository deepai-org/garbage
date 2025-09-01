# PolyScript Test Coverage Audit

## ✅ Features with Test Coverage

### Declarations (§7)
- ✅ Variable declarations (`let`, `var`)
- ✅ Const declarations (`const`)
- ✅ Short declarations (`:=`)
- ✅ Function declarations (`function`, `def`, `fun`, `fn`)
- ✅ Async functions
- ✅ Type declarations
- ✅ Import statements

### Expressions (§9)
- ✅ Numeric literals
- ✅ String literals
- ✅ Template literals
- ✅ Regex literals
- ✅ Boolean literals (`true`, `false`)
- ✅ Null literal
- ✅ Identifiers
- ✅ Sigil identifiers (`$var`)
- ✅ Binary expressions
- ✅ Unary expressions
- ✅ Assignment expressions
- ✅ Ternary operator (`?:`)
- ✅ Function calls
- ✅ Member access
- ✅ Optional chaining (`?.`)
- ✅ Array literals
- ✅ Object literals
- ✅ Lambda expressions (`=>`)
- ✅ Operator precedence

### Statements (§8)
- ✅ If statements
- ✅ If-else statements
- ✅ Elif chains
- ✅ For loops
- ✅ While loops
- ✅ Foreach loops
- ✅ Switch statements
- ✅ Try-catch statements
- ✅ Try-catch-finally
- ✅ Return statements
- ✅ Break statements
- ✅ Continue statements
- ✅ Echo/print statements
- ✅ Using statements
- ✅ Defer statements

### Types (§6)
- ✅ Simple types
- ✅ Nullable types (`?`)
- ✅ Union types (`|`)
- ✅ Generic types (`<>`)
- ✅ Function types

### Special Features
- ✅ MASI (semicolon insertion)
- ✅ Reassignment operator (`:=:`)
- ✅ Error recovery

## ❌ Missing Test Coverage

### Declarations (§7)
- ❌ `auto` keyword for variables
- ❌ `final`, `immutable` keywords for constants
- ❌ `unsafe` function modifier
- ❌ Function with return type before name (e.g., `int add(a, b)`)
- ❌ Class declarations
- ❌ Interface/trait declarations
- ❌ Enum declarations
- ❌ Struct declarations
- ❌ Multiple variable declarations (e.g., `let x, y, z`)
- ❌ Variable declarations with type annotations
- ❌ `require` for imports
- ❌ `#include` for textual inclusion
- ❌ Import with `as` alias

### Expressions (§9)
- ❌ Numeric literals with:
  - Hex (`0x`), octal (`0o`), binary (`0b`)
  - Underscores (`1_000_000`)
  - Type suffixes (`42L`, `3.14f`)
  - BigInt suffix (`42n`)
  - Exponent notation (`1.5e10`)
- ❌ String literals with:
  - Single quotes
  - Triple quotes (`'''`, `"""`)
  - Raw strings (`r"..."`)
  - Byte strings (`b"..."`)
  - Format strings (`f"..."`)
  - Const strings (`c"..."`)
  - Ruby percent literals (`%q{...}`)
  - Bash strings (`$'...'`)
  - C# verbatim strings (`@"..."`)
- ❌ `undefined` (alias for null)
- ❌ Backtick identifiers (`` `keyword` ``)
- ❌ Index access (`arr[0]`)
- ❌ Postfix increment/decrement (`x++`, `x--`)
- ❌ Prefix increment/decrement (`++x`, `--x`)
- ❌ `new` expressions
- ❌ `typeof`, `void`, `delete`, `await` operators
- ❌ `in`, `instanceof` operators
- ❌ Regex match operator (`=~`)
- ❌ Spaceship operator (`<=>`)
- ❌ Null coalescing (`??`)
- ❌ Compound assignments (`+=`, `-=`, etc.)
- ❌ Bitwise operators (`&`, `|`, `^`, `~`, `<<`, `>>`, `>>>`)
- ❌ Exponentiation (`**`)
- ❌ Sequence operator (`,`)
- ❌ Spread operator (`...`)
- ❌ `go` expression for concurrency
- ❌ Channel operations (`<-`, `->`)

### Statements (§8)
- ❌ Until loops
- ❌ Infinite loops (`loop`)
- ❌ For-in loops (`for x in collection`)
- ❌ Labeled break/continue
- ❌ Match statements (alternative to switch)
- ❌ Case statements (Bash-style)
- ❌ Fallthrough in switch
- ❌ `with` statements
- ❌ `except`/`rescue` (aliases for catch)
- ❌ `throw` statements
- ❌ Expression statements with complex expressions

### Block Delimiters (§3)
- ❌ Indent-based blocks (Python-style with `:`)
- ❌ Keyword blocks (`do`/`done`, `begin`/`end`, `fi`, `esac`)
- ❌ Mixed block delimiter error detection

### Types (§6)
- ❌ Built-in types (`i8`, `i16`, `i32`, `i64`, `u8`, `u16`, `u32`, `u64`, `f32`, `f64`)
- ❌ `any`, `never` types
- ❌ `bool`, `bytes`, `string`, `char`, `bigint` types
- ❌ Channel types (`chan<T>`)
- ❌ Array/slice type syntax (`[]T` or `Array<T>`)
- ❌ Map/dict type syntax
- ❌ Tuple types
- ❌ Type parameters/generics in declarations

### Module System (§11)
- ❌ Different import path formats
- ❌ Cyclic import detection
- ❌ Package declarations
- ❌ Export statements

### Special Features
- ❌ Shebang (`#!/usr/bin/env polyscript`)
- ❌ HTML comments (`<!-- -->`)
- ❌ Bash/Ruby comments (`#`, `--`)
- ❌ Directive comments (`// @generics`, `// @nogenerics`)
- ❌ Attributes (`[#[name]]`, `@annotation`)
- ❌ Soft keywords (`regex`, `div`, `fallthrough`)
- ❌ Multiple statements on one line with `;`
- ❌ Virtual semicolon suppression rules
- ❌ Generic disambiguation with `<`

### Advanced Features
- ❌ Async/await in expressions
- ❌ Generator functions (`yield`)
- ❌ Destructuring assignments
- ❌ Pattern matching in switch/match
- ❌ List comprehensions (Python-style)
- ❌ Method declarations in classes
- ❌ Constructor declarations
- ❌ Property accessors (get/set)
- ❌ Static members
- ❌ Visibility modifiers (public/private/protected)

## Summary

**Current Coverage:** ~40% of language features
**Well Covered:** Basic control flow, simple expressions, common declarations
**Major Gaps:** 
- Advanced literals (hex, octal, string prefixes)
- Many operators (bitwise, increment, typeof, etc.)
- Block delimiter varieties
- Type system details
- Module system
- Class/interface features
- Concurrency features