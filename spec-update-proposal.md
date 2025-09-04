# PolyScript Spec Update Proposal

## Problem Statement

The PolyScript parser implementation (parser.ts) contains valid TypeScript/JavaScript code that is not parseable as valid PolyScript according to the current spec. This creates a fundamental issue where the parser cannot parse its own source code.

## Key Missing Constructs

### 1. Do-While Loops

**Current Spec (Line 271):**
```
Loop ::= For | While | Until | Foreach | Infinite ;
```

**Proposed Addition:**
```
Loop ::= For | While | DoWhile | Until | Foreach | Infinite ;

DoWhile ::= "do" Block "while" "(" Expr ")" [ ";" ] ;
```

**Rationale:** JavaScript/TypeScript do-while loops are common and appear in parser.ts:
```javascript
do {
  genericParams.push(this.parseIdentifier());
} while (this.match(","));
```

### 2. Clarification on `do` Keyword Context

**Current Spec:** 
- Line 154 shows `do` as a keyword matched with `done` (Bash-style)
- This conflicts with JavaScript's `do-while` usage

**Proposed Update:**
Add to section 8.1 (Control flow):
```
The keyword "do" has two contexts:
1. Followed by "{" or an indented block and "while" → JavaScript-style do-while loop
2. Followed by statements and "done" → Bash-style command group

The parser disambiguates by lookahead after the block.
```

### 3. Method Shorthand in Object Literals

**Current Issue:** Object literals with method shorthand aren't explicitly covered.

**Proposed Addition to Section 9 (Expressions):**
```
ObjectLiteral ::= "{" [ ObjectMember { "," ObjectMember } ] "}" ;
ObjectMember  ::= 
    | Identifier "(" ParamList ")" Block           // method shorthand
    | Identifier ":" Expr                          // property
    | Identifier                                   // shorthand property
    | "[" Expr "]" ":" Expr                       // computed property
    | "..." Expr                                   // spread
```

### 4. Keywords as Property Names

**Current Issue:** Keywords like `async`, `unsafe`, `generator` can't be used as property names in object literals.

**Proposed Addition to Section 2.3:**
```
In object literal property positions and after ".", any keyword may be used as an identifier without backticks. This includes but is not limited to:
- Object property keys: { async: true, for: 42 }
- Member access: obj.class, this.return
```

## Implementation Impact

These changes would:
1. Allow the parser to parse its own source code
2. Maintain backward compatibility (only adding features, not removing)
3. Align better with JavaScript/TypeScript semantics
4. Keep the "every valid program in JavaScript... is valid PolyScript" promise

## Specific Examples from parser.ts That Would Be Fixed

```typescript
// Do-while loop (currently fails)
do {
  genericParams.push(this.parseIdentifier());
} while (this.match(","));

// Keywords as object properties (partially fixed, needs spec clarification)
return {
  kind: "FuncDecl",
  async,      // keyword as property
  unsafe,     // keyword as property  
  generator,  // identifier as property
  body: body as AST.Block
};

// Complex control flow mixing
if (condition) {
  // ...
} else if (this.check("do")) {
  // This should parse do-while, not bash do-done
  do {
    statements.push(this.parseStatement());
  } while (!this.check("end"));
}
```

## Testing

Add test cases:
1. Do-while loops with various body types
2. Keywords as object property names
3. Disambiguation between do-while and do-done
4. Nested do-while loops
5. Do-while with break/continue

## Backward Compatibility

All changes are additive. Existing valid PolyScript programs remain valid.