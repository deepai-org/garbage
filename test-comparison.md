# Test Analysis: "parses mixed async/concurrent patterns"

## Current Test (WEAK) ❌

```typescript
test('parses mixed async/concurrent patterns', () => {
    const code = `...complex polyglot code...`;
    const ast = parseCode(code);
    expect(ast.body.length).toBeGreaterThanOrEqual(1);  // <-- Only checks this!
});
```

### What it checks:
- ✅ Code doesn't throw a parse error
- ✅ AST has at least 1 node

### What it DOESN'T check:
- ❌ Whether `Stream<T>` is parsed as a generic type or comparison
- ❌ Whether `Vec<T>` is parsed correctly  
- ❌ Whether `<-ch` is parsed as channel receive or comparison
- ❌ Whether `ch <- item` is parsed as channel send
- ❌ Whether `i < 10` is parsed as comparison
- ❌ Whether generic function parameters work
- ❌ Whether async/await is handled properly

## The Problem

This code has **7 different uses of angle brackets**:

1. `processStream<T>` - Function generic parameter
2. `Stream<T>` - Generic type
3. `Result<Vec<T>, Error>` - Nested generic with 2 params
4. `Vec<T>` - Generic inside another generic
5. `i < 10` - Comparison operator
6. `<-ch` - Channel receive operation
7. `ch <- item` - Channel send operation

The test doesn't verify ANY of these are parsed correctly!

## What Could Go Wrong

The parser could:
- Parse `Stream<T>` as `Stream < T` (comparison)
- Parse `<-ch` as `< -ch` (less than negative ch)
- Parse `Vec<T>` as `Vec < T` (comparison)
- Miss the nested generics entirely
- Fail to recognize channel operations

And the test would still pass! 🤦

## Proper Test (STRONG) ✅

```typescript
test('parses mixed async/concurrent patterns', () => {
    const code = `...`;
    const ast = parseCode(code);
    
    // Verify function structure
    const func = ast.body[0] as AST.FuncDecl;
    expect(func.kind).toBe('FuncDecl');
    expect(func.name.name).toBe('processStream');
    expect(func.async).toBe(true);
    
    // Verify generic parameter <T>
    expect(func.genericParams).toHaveLength(1);
    expect(func.genericParams[0].name).toBe('T');
    
    // Verify parameter type Stream<T>
    const paramType = func.params[0].type as AST.GenericType;
    expect(paramType.kind).toBe('GenericType');
    expect(paramType.base.name).toBe('Stream');
    expect(paramType.args[0].name).toBe('T');
    
    // Verify return type Result<Vec<T>, Error>
    const returnType = func.returnType as AST.GenericType;
    expect(returnType.kind).toBe('GenericType');
    expect(returnType.base.name).toBe('Result');
    expect(returnType.args).toHaveLength(2);
    
    // Verify nested generic Vec<T>
    const vecType = returnType.args[0] as AST.GenericType;
    expect(vecType.kind).toBe('GenericType');
    expect(vecType.base.name).toBe('Vec');
    
    // Verify function body contains expected statements
    const body = func.body as AST.Block;
    expect(body.statements.length).toBeGreaterThan(3);
    
    // Find and verify the for loop
    const forLoop = body.statements.find(s => s.kind === 'For');
    expect(forLoop).toBeDefined();
    
    // Verify comparison in loop condition (i < 10)
    const condition = forLoop.condition as AST.Binary;
    expect(condition.kind).toBe('Binary');
    expect(condition.op).toBe('<');
    
    // Find channel operations
    const hasChannelReceive = JSON.stringify(ast).includes('"op":"<-"');
    const hasChannelSend = JSON.stringify(ast).includes('"op":"<-"');
    expect(hasChannelReceive).toBe(true);
    expect(hasChannelSend).toBe(true);
});
```

## Summary

The current test is essentially useless for verifying angle bracket disambiguation. It would pass even if:
- All generics were parsed as comparisons
- Channel operations were completely broken
- The parser ignored half the syntax

A proper test must verify the **actual AST structure** to ensure each angle bracket is interpreted correctly based on context.