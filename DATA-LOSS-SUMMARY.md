# Parser Data Loss Issues Summary

## Critical Issues Found

### 1. Comments Completely Stripped (Lexer Level)
- **Severity**: High for tools that need comments (documentation generators, formatters)
- **Location**: Lexer doesn't emit comment tokens at all
- **Impact**: All comments are lost before parsing even begins
- **Fix Required**: Lexer modification to emit Comment tokens

### 2. Unknown Modifiers Misparsed as Fields
- **Severity**: High 
- **Example**: `volatile x: number` parsed as two fields: "volatile" and "x"
- **Location**: Class member parsing (lines 5420-5710)
- **Impact**: Unknown language keywords treated as identifiers
- **Fix Required**: Store unknown modifiers in `unknownModifiers` array on ClassMember

### 3. Virtual Semicolons Discarded
- **Severity**: Medium (important for formatters)
- **Location**: Throughout parser (152-153, 181-189, 225-227, etc.)
- **Impact**: Line break information lost
- **Fix Required**: Optional - could store in AST nodes for formatting tools

### 4. Error Recovery Token Loss
- **Severity**: Medium
- **Location**: synchronize() method and error recovery blocks
- **Impact**: Tokens skipped during error recovery are lost
- **Fix Required**: Store skipped tokens in error nodes

### 5. Failed Parse Attempt Rollbacks
- **Severity**: Low
- **Location**: Checkpoint/restore patterns throughout
- **Impact**: Partial parse results discarded on failure
- **Fix Required**: Complex - would need to preserve partial ASTs

## Addressable Issues

The most practical issues to fix:

1. **Unknown modifiers** - Can add `unknownModifiers: string[]` to ClassMember
2. **Comments** - Requires lexer change to emit comment tokens
3. **Error recovery** - Can store skipped tokens in a special error node

## Current State

The parser already handles most data preservation well:
- ✅ Destructuring patterns preserved
- ✅ Unknown impl members stored as Unknown type
- ✅ Decorators fully preserved
- ✅ Type information complete
- ✅ Import/export specifiers stored

The remaining issues are edge cases that would mainly affect:
- Code formatting tools (need comments and virtual semicolons)
- Multi-language support (need unknown modifier preservation)
- Error recovery tools (need skipped token information)