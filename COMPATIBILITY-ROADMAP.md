# JSX/TSX Full Compatibility Roadmap

## Executive Summary

To achieve 100% test compatibility (307/307 tests passing), we need to fix **5 key issues** that will resolve the 20 remaining test failures.

## Current State
- ✅ **287/307** tests passing (93.5%)
- ❌ **20** tests failing
- 🔧 **Main blocker**: Virtual semicolon insertion in JSX

## Priority Fixes (Ranked by Impact)

### 🔴 Priority 1: Virtual Semicolon in JSX (Impact: 19 failures)
**Problem**: Lexer inserts virtual semicolons after `}` in JSX, breaking parsing
```jsx
<div>
    {expr}    // <- Virtual semicolon inserted here
    <span>    // <- Treated as new statement, fails
</div>
```

**Solution**: Add JSX context tracking to lexer
- **Effort**: 2-3 days
- **Files**: `src/lexer.ts`
- **Impact**: Fixes ~95% of JSX test failures

### 🟡 Priority 2: Class Generic Parameters (Impact: 4 failures)
**Problem**: Classes use `typeParams` instead of expected `genericParams`

**Solution**: Quick property rename or dual support
- **Effort**: 1 hour
- **Files**: `src/parser.ts`, `src/ast.ts`
- **Impact**: Fixes TypeScript class tests

### 🟡 Priority 3: Package Declarations (Impact: 1-2 failures)
**Problem**: `package main;` not recognized

**Solution**: Add package declaration parsing
- **Effort**: 2 hours
- **Files**: `src/parser.ts`, `src/ast.ts`
- **Impact**: Fixes Go-style tests

### 🟢 Priority 4: Decorator Support (Impact: 2 failures)
**Problem**: Decorators on classes/methods need AST node storage

**Solution**: Add decorator field to AST nodes
- **Effort**: 3-4 hours
- **Files**: `src/ast.ts`, `src/parser.ts`
- **Impact**: Fixes advanced TypeScript tests

### 🟢 Priority 5: Minor AST Mismatches (Impact: 1-2 failures)
**Problem**: Various property name differences

**Solution**: Enhance compatibility layer
- **Effort**: 1-2 hours
- **Files**: `test/helpers/ast-compat.ts`
- **Impact**: Fixes remaining edge cases

## Implementation Schedule

### Day 1: Quick Wins (4-5 hours)
- [ ] Fix class `genericParams` (1 hour)
- [ ] Add package declaration support (2 hours)
- [ ] Update compatibility layer (1-2 hours)
- **Expected Result**: 291-292/307 tests passing (~95%)

### Day 2-3: Virtual Semicolon Fix (Main effort)
- [ ] Implement JSX context tracking in lexer
- [ ] Test thoroughly with all JSX patterns
- [ ] Ensure no regressions
- **Expected Result**: 305-306/307 tests passing (~99.7%)

### Day 4: Polish & Edge Cases
- [ ] Add decorator support
- [ ] Fix any remaining issues
- [ ] Performance optimization
- **Expected Result**: 307/307 tests passing (100%)

## Success Metrics

| Milestone | Tests Passing | Percentage | Status |
|-----------|--------------|------------|--------|
| Current | 287/307 | 93.5% | ✅ |
| After Quick Wins | 291/307 | 94.8% | ⏳ |
| After Virtual Semi Fix | 306/307 | 99.7% | ⏳ |
| Full Compatibility | 307/307 | 100% | 🎯 |

## Risk Mitigation

### Risks
1. **Virtual semicolon fix breaks other features**
   - Mitigation: Comprehensive test suite, careful JSX detection

2. **Performance regression**
   - Mitigation: Benchmark before/after, optimize hot paths

3. **AST breaking changes**
   - Mitigation: Use compatibility layer, careful migration

## Testing Strategy

### For Each Fix
1. Run targeted test suite
2. Run full test suite
3. Check for regressions
4. Benchmark performance
5. Document changes

## Quick Start Commands

```bash
# Test current state
npm test

# Test JSX specifically
npm test -- test/jsx-

# Test after each fix
npm test 2>&1 | grep -E "Tests:"

# Check specific failures
npm test -- --verbose 2>&1 | grep -B5 "Expected"
```

## File Modification Guide

### Virtual Semicolon Fix
```typescript
// src/lexer.ts
class Lexer {
  private jsxDepth = 0;  // Add this
  
  private shouldInsertVirtualSemicolon(): boolean {
    if (this.jsxDepth > 0) return false;  // Add this check
    // ... existing logic
  }
}
```

### Generic Parameters Fix
```typescript
// src/parser.ts - in parseClassDecl()
genericParams: typeParams,  // Quick fix: rename
// OR
typeParams: params,
genericParams: params,  // Dual support
```

### Package Declaration
```typescript
// src/parser.ts - in parseDeclaration()
if (this.match("package")) {
  const name = this.parseIdentifier();
  this.consumeSemicolon();
  return {
    kind: "PackageDecl",
    name,
    span: this.createSpan(start, this.current)
  };
}
```

## Validation Checklist

- [ ] All 307 tests pass
- [ ] No performance regression (< 5% impact)
- [ ] JSX parsing works with all patterns
- [ ] TypeScript features work
- [ ] Go-style features work
- [ ] Python-style features work
- [ ] No breaking changes to existing code

## Next Steps

1. **Immediate**: Fix class `genericParams` (1 hour task, quick win)
2. **Today**: Complete all quick wins (Day 1 tasks)
3. **This Week**: Implement virtual semicolon fix
4. **Result**: Achieve 100% test compatibility

---

**Estimated Total Effort**: 3-4 days
**Expected Completion**: End of week
**Confidence Level**: High (95%)

With these fixes, PolyScript will have full JSX/TSX compatibility and support all intended language features.