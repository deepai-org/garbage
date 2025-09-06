# Full JSX/TSX Compatibility Plan

## Current Status
- **287/307 tests passing (93.5%)**
- **20 tests failing** across 11 test files
- Main blocker: Virtual semicolon insertion breaking JSX parsing

## Goal
Achieve 100% test pass rate with full JSX/TSX syntax compatibility

## Phase 1: Fix Virtual Semicolon Issue in JSX Context (Critical)

### Problem
The lexer inserts virtual semicolons after `}` when followed by newlines, which breaks JSX:
```jsx
<div>
    {/* comment */}  // <- Virtual semicolon inserted here
    <span>test</span> // <- Parsed as new statement, fails
</div>
```

### Solution Approach
1. **Add JSX context tracking to lexer**
   - Track when we're inside JSX elements
   - Don't insert virtual semicolons between JSX children
   - Maintain a JSX depth counter

2. **Implementation Steps**
   ```typescript
   // In lexer.ts
   private jsxDepth = 0;
   
   // Track JSX element entry/exit
   - When seeing `<` followed by identifier: jsxDepth++
   - When seeing `</`: jsxDepth--
   - When jsxDepth > 0: suppress virtual semicolon after `}`
   ```

3. **Files to modify**
   - `src/lexer.ts`: Add JSX context tracking
   - `src/tokens.ts`: Add JSX context flag if needed

## Phase 2: Fix Package Declaration Parsing

### Problem
`package main;` statements not being recognized

### Solution
1. **Add package declaration support to parser**
   ```typescript
   // In parser.ts parseDeclaration()
   if (this.match("package")) {
     return this.parsePackageDecl();
   }
   ```

2. **Add AST node if missing**
   ```typescript
   export interface PackageDecl {
     kind: "PackageDecl";
     name: Identifier;
     span: Span;
   }
   ```

## Phase 3: Fix Class Generic Parameters

### Problem
Classes missing `genericParams` property, using `typeParams` instead

### Solution
1. **Update parser to use consistent naming**
   - Change `typeParams` to `genericParams` in class parsing
   - Or add both properties for compatibility

2. **Update AST types**
   ```typescript
   export interface ClassDecl {
     genericParams?: TypeParam[]; // Ensure this exists
     // ...
   }
   ```

## Phase 4: Fix Go-style Language Features

### Problems
- `go` statements not creating proper AST nodes
- Channel operations need verification
- `defer` statements need proper handling

### Solution
1. **Enhance Go-style parsing**
   ```typescript
   // In parseStatement()
   if (this.match("go")) {
     return this.parseGoStatement();
   }
   if (this.match("defer")) {
     return this.parseDeferStatement();
   }
   ```

2. **Add missing AST nodes**
   ```typescript
   export interface GoStmt {
     kind: "Go";
     call: CallExpr;
     span: Span;
   }
   ```

## Phase 5: Complete JSX/TSX Feature Support

### Missing Features
1. **JSX Namespaced Elements**
   - `<namespace:element>`
   
2. **JSX Member Elements** 
   - `<Component.SubComponent>`
   
3. **TSX Generic Components**
   - `<Component<T>>` disambiguation
   
4. **JSX Spread Children**
   - `{...children}` in JSX context

### Solution
- Enhance JSX parser with full React/TSX compatibility
- Add proper type parameter support in JSX context
- Improve angle bracket disambiguation

## Phase 6: Fix Remaining Edge Cases

### Issues to Address
1. **Decorator parsing** - `@decorator` before classes/functions
2. **Type assertions in JSX** - Proper `as` handling
3. **Async generators** - `async function*`
4. **Optional chaining in JSX** - `?.` operator
5. **Nullish coalescing** - `??` operator

## Implementation Order

### Week 1: Critical Fixes
1. **Day 1-2**: Fix virtual semicolon in JSX context
2. **Day 3**: Fix package declarations
3. **Day 4**: Fix class generic parameters
4. **Day 5**: Test and verify fixes

### Week 2: Language Features
1. **Day 1**: Go-style statements (go, defer)
2. **Day 2**: Channel operations
3. **Day 3**: Decorators
4. **Day 4**: Async generators
5. **Day 5**: Integration testing

### Week 3: JSX/TSX Completion
1. **Day 1**: JSX namespaced elements
2. **Day 2**: JSX member elements  
3. **Day 3**: TSX generic components
4. **Day 4**: JSX spread children
5. **Day 5**: Final testing and polish

## Testing Strategy

### Phase Testing
After each phase:
1. Run full test suite
2. Fix any regressions
3. Add new tests for features
4. Update documentation

### Regression Prevention
1. Create test for each fixed issue
2. Add edge case tests
3. Maintain compatibility tests
4. Performance benchmarks

## Success Metrics

### Must Have (P0)
- [ ] 100% test pass rate
- [ ] Virtual semicolon issue resolved
- [ ] All JSX tests passing
- [ ] No parser errors on valid code

### Should Have (P1)
- [ ] Full TSX type support
- [ ] Go-style concurrency features
- [ ] Decorator support
- [ ] Performance maintained or improved

### Nice to Have (P2)
- [ ] Additional language features
- [ ] Enhanced error messages
- [ ] Better error recovery
- [ ] Source maps support

## Risk Mitigation

### Potential Risks
1. **Virtual semicolon fix breaks other languages**
   - Mitigation: Extensive testing across all language features
   - Add regression tests for each language

2. **Performance degradation**
   - Mitigation: Benchmark before/after each change
   - Optimize hot paths

3. **AST breaking changes**
   - Mitigation: Use compatibility layer
   - Version AST changes

## Validation Plan

### Test Coverage
1. **Unit tests**: Each feature individually
2. **Integration tests**: Language combinations
3. **E2E tests**: Real-world code examples
4. **Fuzzing**: Random valid syntax generation

### Real-world Testing
1. Parse popular React components
2. Parse TypeScript+JSX projects
3. Parse Go codebases with channels
4. Parse Python with decorators

## Documentation Updates

### Required Documentation
1. Update `spec.md` with all features
2. Create migration guide for breaking changes
3. Document all AST node types
4. Add examples for each feature

## Timeline Summary

**Total Duration**: 3 weeks

**Week 1**: Critical parser fixes (Virtual semicolon, package, generics)
**Week 2**: Language features (Go, decorators, async)  
**Week 3**: JSX/TSX completion and testing

**Expected Outcome**: 
- 100% test compatibility
- Full JSX/TSX support
- All polyglot features working
- Production-ready parser

## Next Steps

1. **Immediate**: Start with virtual semicolon fix (highest impact)
2. **This Week**: Complete Phase 1-3
3. **Review**: After Phase 3, reassess priorities based on test results

## Appendix: Specific Test Failures to Fix

### High Priority (Blocking multiple tests)
1. Virtual semicolon in JSX - affects 10+ tests
2. Package declarations - affects parser-comprehensive tests
3. Generic parameters - affects class-based tests

### Medium Priority (Feature-specific)
1. Go statements - affects polyglot tests
2. Decorators - affects advanced tests
3. Type assertions - affects TypeScript tests

### Low Priority (Edge cases)
1. Complex nested generics
2. Unusual operator combinations
3. Extreme polyglot mixing

---

**Success Criteria**: When all 307 tests pass, we have achieved full compatibility.