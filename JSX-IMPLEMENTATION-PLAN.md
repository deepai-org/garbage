# JSX Implementation Plan for PolyScript Parser

## Current Situation
- ✅ JSX specification added to spec.md
- ✅ Comprehensive test suite created (60 tests)
- ❌ JSX parsing NOT implemented in parser
- ❌ Tests only check for no errors, not correct AST structure
- ❌ Lexer tokenizes JSX as individual operators, not JSX-specific tokens

## Implementation Plan

### Phase 1: AST Node Design
**Goal**: Define JSX-specific AST node types

1. **Create JSX AST node interfaces** in `src/ast-types.ts`:
   - `JSXElement`: For `<div>...</div>` and `<Component />`
   - `JSXFragment`: For `<>...</>`
   - `JSXOpeningElement`: Opening tag with attributes
   - `JSXClosingElement`: Closing tag
   - `JSXAttribute`: Individual props
   - `JSXSpreadAttribute`: Spread props `{...props}`
   - `JSXText`: Text content between tags
   - `JSXExpressionContainer`: `{expression}` in JSX
   - `JSXIdentifier`: Component/element names
   - `JSXMemberExpression`: `<Form.Input />`

### Phase 2: Lexer Enhancement
**Goal**: Add JSX-aware tokenization

1. **Add JSX lexer modes**:
   - `JSXTag`: Inside `< >` for parsing attributes
   - `JSXContent`: Between opening and closing tags
   - `JSXExpression`: Inside `{}` within JSX

2. **Implement context switching**:
   - Enter JSX mode when `<` followed by identifier or `>`
   - Track JSX depth for nested elements
   - Switch to expression mode on `{`
   - Exit JSX mode on matching close tag

3. **Add JSX-specific tokens**:
   - `JSXTagStart`: `<` when starting JSX
   - `JSXTagEnd`: `>` when ending JSX tag
   - `JSXSelfClose`: `/>`
   - `JSXText`: Text content in JSX

### Phase 3: Parser Core Implementation
**Goal**: Implement JSX parsing logic

1. **JSX Detection** (`parseJSXElement`):
   ```typescript
   // Detect JSX vs less-than operator
   if (token === '<') {
     const next = this.peek();
     if (isJSXStart(next)) {
       return this.parseJSXElement();
     }
     // Otherwise it's a comparison operator
   }
   ```

2. **Element Parsing** (`parseJSXElement`):
   - Parse opening tag
   - Parse attributes
   - Check for self-closing (`/>`)
   - Parse children if not self-closing
   - Parse closing tag and verify match

3. **Attribute Parsing** (`parseJSXAttributes`):
   - Parse identifier attributes
   - Parse `key={value}` attributes
   - Parse spread `{...props}`
   - Handle boolean attributes (no value)

4. **Children Parsing** (`parseJSXChildren`):
   - Parse text nodes
   - Parse expression containers `{expr}`
   - Parse nested elements recursively
   - Handle whitespace normalization

5. **Fragment Parsing** (`parseJSXFragment`):
   - Detect `<>` opening
   - Parse children
   - Verify `</>` closing

### Phase 4: Disambiguation Logic
**Goal**: Handle JSX vs TypeScript generics

1. **Lookahead Strategy**:
   ```typescript
   function isJSXElement(tokens: Token[]): boolean {
     // <Component /> - definitely JSX
     // <T> - could be generic or JSX
     // <T extends - definitely generic
     // <div> - definitely JSX (HTML tag)
   }
   ```

2. **Context-based Rules**:
   - After `=`, `return`, `(`, `{`: likely JSX
   - After type keywords: likely generic
   - Capital letter after `<`: check for JSX patterns
   - Lowercase after `<`: check HTML tag list

### Phase 5: Integration Points
**Goal**: Integrate JSX with existing parser

1. **Update `parseExpression`**:
   - Add JSX element as valid expression
   - Handle JSX in ternary, arrays, objects

2. **Update `parseStatement`**:
   - Allow standalone JSX (though unusual)
   - Handle JSX in return statements

3. **Update `parseAssignment`**:
   - Allow JSX as right-hand side

### Phase 6: Testing Improvements
**Goal**: Ensure correct AST generation

1. **Update test assertions**:
   ```typescript
   it('should parse JSX element correctly', () => {
     const ast = parser.parse('<div>Hello</div>');
     expect(ast.body[0].kind).toBe('ExprStmt');
     expect(ast.body[0].expr.kind).toBe('JSXElement');
     expect(ast.body[0].expr.tag).toBe('div');
     expect(ast.body[0].expr.children[0].kind).toBe('JSXText');
     expect(ast.body[0].expr.children[0].value).toBe('Hello');
   });
   ```

2. **Add AST snapshot tests**:
   - Capture expected AST structure
   - Compare against actual output

### Phase 7: Transpilation
**Goal**: Convert JSX to JavaScript

1. **Implement JSX transformer**:
   ```typescript
   // <div className="test">Hello</div>
   // Becomes:
   // React.createElement("div", {className: "test"}, "Hello")
   ```

2. **Support different JSX runtimes**:
   - Classic: `React.createElement`
   - Automatic: `_jsx` from react/jsx-runtime
   - Custom pragma: `h`, `m`, etc.

## Implementation Order

1. **Start with AST types** (Phase 1)
   - Define all node interfaces
   - Update existing AST type unions

2. **Implement basic parsing** (Phase 3, partial)
   - Self-closing elements
   - Simple container elements
   - No attributes initially

3. **Add attribute support** (Phase 3, continued)
   - String attributes
   - Expression attributes
   - Spread attributes

4. **Add children support** (Phase 3, continued)
   - Text children
   - Expression children
   - Nested elements

5. **Enhance lexer** (Phase 2)
   - Add JSX modes for better tokenization
   - Improve whitespace handling

6. **Add disambiguation** (Phase 4)
   - JSX vs generics
   - JSX vs comparison operators

7. **Update tests** (Phase 6)
   - Verify AST structure
   - Add edge case tests

8. **Implement transpilation** (Phase 7)
   - Basic React.createElement
   - Support for different runtimes

## Success Criteria

- [ ] All 60 JSX tests produce correct AST nodes
- [ ] JSX elements are properly parsed with attributes and children
- [ ] JSX fragments work correctly
- [ ] JSX vs generics disambiguation works
- [ ] Mixed TypeScript/JSX code parses correctly
- [ ] JSX can be transpiled to JavaScript
- [ ] No regression in existing parser tests

## Estimated Effort

- **Phase 1**: 2 hours - AST type definitions
- **Phase 2**: 4 hours - Lexer enhancements
- **Phase 3**: 8 hours - Core parser implementation
- **Phase 4**: 3 hours - Disambiguation logic
- **Phase 5**: 2 hours - Integration
- **Phase 6**: 3 hours - Test improvements
- **Phase 7**: 4 hours - Transpilation

**Total**: ~26 hours of implementation work

## Risks & Mitigations

1. **Risk**: Breaking existing parser functionality
   - **Mitigation**: Run full test suite after each change

2. **Risk**: Complex disambiguation edge cases
   - **Mitigation**: Start with clear cases, add complexity gradually

3. **Risk**: Performance impact from lookahead
   - **Mitigation**: Use efficient lookahead strategies, cache results

4. **Risk**: Incompatible with existing expression parsing
   - **Mitigation**: Carefully integrate at appropriate parser points