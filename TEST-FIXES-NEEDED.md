# Test Fixes Needed

## Quick Fixes for TypeScript Compilation Errors

Based on AST interface analysis, these test files need updates:

### 1. `test/parser-polyglot-updated.test.ts`
- Change `try.finally` to `try.finallyBody`
- Change `matchArm.pattern` to `matchArm.patterns`
- Remove `switchCase.isDefault` (use `switch.defaultCase` instead)

### 2. `test/parser-polyglot-showcase-updated.test.ts`
- Change `classDecl.body` to `classDecl.members`
- Change `AST.For` to `AST.Loop`
- For ShortDecl, use `shortDecl.pairs[0].name` instead of `shortDecl.name`

### 3. Other test files with similar issues
- Update all references to match actual AST interfaces

## Parser Fixes Needed

### 1. Ruby `end` keyword (High Priority)
**Issue**: `end` after function body is parsed as separate identifier
**Fix**: Need to properly handle Ruby function termination

### 2. Generic types in member access calls (Medium Priority)
**Issue**: `React.forwardRef<T1, T2>` generics not recognized
**Fix**: Parser needs to handle generics after member access in call expressions

### 3. Mixed paradigm features (Low Priority)
- Python decorators with JSX
- C# properties in JSX components
- defer/using statements with JSX

## Implementation Priority

1. **Immediate**: Fix test TypeScript errors (30 min)
   - Simple find/replace in test files
   - Will likely fix 4+ tests immediately

2. **Next**: Fix Ruby end keyword (1-2 hours)
   - Modify function parsing to consume Ruby `end`
   - Check for Ruby-style function definitions

3. **Later**: Generic type improvements (2-3 hours)
   - Enhance parseCall to handle generics after member access
   - Improve generic type detection in helper functions

4. **Future**: Mixed paradigm edge cases (4+ hours)
   - Each requires specific syntax understanding
   - May need lexer modifications for some cases