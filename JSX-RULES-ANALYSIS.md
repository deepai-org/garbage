# JSX Usage Patterns from Tests Analysis

## Context Where JSX Appears (Valid JSX Contexts):

1. **Expression Statement**: `<Button />` (standalone)
2. **Assignment/Declaration**: `const element = <Component />`
3. **Return Statement**: `return <div>content</div>`
4. **Ternary Operator**: `condition ? <Success /> : <Error />`
5. **Array Elements**: `[<Item key={1} />, <Item key={2} />]`
6. **Object Property Values**: `{ header: <Header />, body: <Body /> }`
7. **Function Call Arguments**: `call(<Component />)`
8. **JSX Attribute Values**: `<Parent child={<Child />} />`
9. **JSX Expression Containers**: `<div>{<Component />}</div>`
10. **Logical Operators**: `show && <Content />`, `!hide || <Placeholder />`
11. **Map Callbacks**: `items.map(item => <Item key={item.id} />)`
12. **Match/Switch Case Results**: `case 'loading' => <Spinner />`
13. **Channel Send**: `ch <- <DataView data={data} />`
14. **After Arrow Functions**: `() => <Component />`
15. **In Parentheses**: `(<Component />)`

## JSX Patterns that Must Be Recognized:

1. **Self-closing Elements**: `<Button />`, `<input type="text" />`
2. **Container Elements**: `<div>content</div>`
3. **Fragments**: `<>content</>`
4. **Components (Capital)**: `<Button>`, `<DataView>`
5. **HTML Elements (lowercase)**: `<div>`, `<span>`, `<input>`
6. **With Attributes**: `<Button size="large" disabled />`
7. **With Expression Attributes**: `<Button onClick={handler} />`
8. **With Spread Attributes**: `<Component {...props} />`
9. **Nested Elements**: `<div><span>text</span></div>`
10. **Mixed Text and Expressions**: `<div>Count: {count} items</div>`
11. **With Comments**: `<div>{/* comment */}</div>`
12. **Namespaced Elements**: `<Form.Input />`, `<ui.Button />`

## Disambiguation Rules from Tests:

### JSX vs Comparison Operators:
- `x < 5` → Comparison (space-separated, right side is number/identifier)
- `<Component />` → JSX (left angle followed by capital letter)
- `<div>` → JSX (left angle followed by HTML tag)
- `x<5 && y>3` → Comparisons (no spaces, in logical expression)

### JSX vs Generics:
- `Array<number>()` → Generic (followed by parentheses = function call)
- `<Array />` → JSX (followed by `/>`  or space = JSX)
- `List<T>({})` → Generic function call
- `<Button>Click</Button>` → JSX (opening/closing tag pair)
- `React.FC<{title: string}>` → Generic type annotation

### JSX vs Type Assertions:
- `<string>value` → Type assertion (primitive type followed by identifier)
- `<Component>content</Component>` → JSX (component followed by content/closing)
- `ref as React.RefObject<HTMLInputElement>` → Use `as` syntax in JSX contexts

## Critical Detection Patterns:

### Definite JSX Triggers:
1. `<>` (Fragment opening)
2. `</` (Closing tag)
3. `<div` (HTML tag)
4. `<Component` (Capital letter component)
5. `<tag attr=` (HTML tag with attributes)
6. `<Tag />` (Self-closing with capital)

### Definite NOT JSX:
1. `<number` (primitive type)
2. `<string>` (primitive type)  
3. `< 5` (space after <)
4. `x<y` (identifier < identifier in expression context)
5. `Array<T>(` (generic function call)

### Context-Dependent:
- After `return`, `=`, `?`, `:`, `=>`, `(`, `{`, `,` → More likely JSX
- In type annotations, after `:` → More likely generic
- Adjacent to identifiers without space → More likely generic/comparison

## Lexer Mode Strategy:

Based on the patterns, JSX detection should trigger when:
1. `<` followed immediately by:
   - Capital letter (Component)
   - Known HTML tag (div, span, input, etc.)
   - `>` (Fragment)
   - `/` (Closing tag)
2. AND in expression context (after `return`, `=`, `=>`, `?`, `:`, `(`, `{`, `,`, etc.)

## Test Evidence Summary:

The tests show JSX is used in all major expression contexts and must be distinguished from:
- Comparison operators (`<`, `>`)
- Generic type parameters (`Array<T>`)
- Type assertions (`<Type>expr`)
- Channel operations (`<-`)
- Shift operators (`<<`, `>>`)

The key is context-aware disambiguation based on what follows `<` and the surrounding expression context.