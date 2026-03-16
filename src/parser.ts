import { Token, TokenType } from './lexer';
import * as AST from './ast';
import { ParserCursor, ParseError } from './parser-cursor';
import * as JSX from './parselets/jsx';
import * as Types from './parselets/types';
import * as Functions from './parselets/functions';
import * as Imports from './parselets/imports';
import * as Literals from './parselets/literals';
import * as ClassDecl from './parselets/class-decl';
import * as ControlFlow from './parselets/control-flow';
import * as Blocks from './parselets/blocks';

export { ParseError } from './parser-cursor';

export class Parser extends ParserCursor {
  constructor(tokens: Token[], source?: string) {
    super(tokens, source);
  }
  
  parse(): AST.Program {
    const body: (AST.Decl | AST.Stmt)[] = [];
    let iterations = 0;
    const maxIterations = Math.max(1000, this.tokens.length * 2); // Safety limit with minimum
    
    while (!this.isAtEnd()) {
      iterations++;
      if (iterations > maxIterations) {
        return {
          kind: "Program",
          body,
          runtimeDirective: this.fileRuntimeDirective,
          span: this.createSpan(0, Math.min(this.current, this.tokens.length - 1))
        };
      }
      
      const beforePos = this.current;
      
      try {
        const item = this.parseTopLevel();
        if (item) {
          body.push(item);
        } else if (!this.isAtEnd()) {
          if (this.current === beforePos) {
            this.advance();
          }
        }
      } catch (error) {
        if (error instanceof ParseError) {
          this.errors.push(error);
          this.synchronize();
        } else {
          throw error;
        }
      }
      
      if (this.current === beforePos && !this.isAtEnd()) {
        this.advance();
      }
    }
    
    return {
      kind: "Program",
      body,
      runtimeDirective: this.fileRuntimeDirective,
      span: this.createSpan(0, this.tokens.length - 1)
    };
  }

  public parseTopLevel(): AST.Decl | AST.Stmt | null {
    this.consumeDirectives();
    
    // Skip virtual semicolons at top level
    let vsCount = 0;
    while (this.peek().virtualSemi) {
      this.advance();
      vsCount++;
      if (vsCount > 100) {
        return null;
      }
    }
    
    if (this.isAtEnd()) return null;

    // Handle closing braces
    // Note: braceDepth only tracks {} blocks (if/for/while/function bodies)
    // It does NOT track braces for classes, interfaces, object literals, etc.
    if (this.check("}")) {
      if (this.braceDepth > 0) {
        // We're inside a statement block, let parseBlock() handle it
        return null;
      } else {
        // This } belongs to a class/interface/object literal/etc
        // It should have been consumed already by the appropriate parser.
        // If we see it here, it's an extra/unmatched brace - skip it and continue
        this.advance();
        return this.parseTopLevel(); // Try to parse the next item
      }
    }
    
    // Check for decorators (@decorator syntax)
    if (this.check("@")) {
      const decorators: AST.Expr[] = [];
      while (this.check("@")) {
        this.advance(); // consume @
        
        // Parse decorator expression (function call or identifier)
        const name = this.parseIdentifier();
        
        // Allow function calls on the decorator: @deprecated("message")
        const decorator = this.parsePostfix(name);
        
        decorators.push(decorator);
        
        // Skip virtual semicolons between decorators
        while (this.peek().virtualSemi) {
          this.advance();
        }
      }
      
      // After decorators, we expect a declaration (function or class)
      // Check for class first since Python can have 'def' inside class
      if (this.match("class")) {
        const cls = ClassDecl.parseClassDecl(this, decorators);
        return cls;
      } else if (this.match("async", "unsafe")) {
        // Handle async/unsafe before function
        const isAsync = this.previous()?.value === "async";
        const isUnsafe = this.previous()?.value === "unsafe";
        
        if (this.match("def", "fun", "fn", "func", "function")) {
          const isGenerator = this.previous()?.value === "function" && this.match("*");
          const func = Functions.parseFuncDecl(this, isAsync, isUnsafe, isGenerator, decorators);
          return func;
        }
      } else if (this.match("def", "fun", "fn", "func", "function")) {
        const isGenerator = this.previous()?.value === "function" && this.match("*");
        const func = Functions.parseFuncDecl(this, false, false, isGenerator, decorators);
        return func;
      }
      
      // If we have decorators but no valid declaration follows, it's an error
      throw this.error(this.peek(), "Expected function or class declaration after decorators");
    }
    
    // Check for short declaration first (including destructuring)
    if (this.peek().type === TokenType.Identifier) {
      const checkpoint = this.current;
      this.advance();
      if (this.check(":=")) {
        this.current = checkpoint;
        return this.parseShortDecl();
      }
      this.current = checkpoint;
    } else if ((this.peek().value === "{" || this.peek().value === "[") && 
               this.peekAhead(":=")) {
      // Destructuring pattern with :=
      return this.parseDestructuringShortDecl();
    }
    
    if (this.isDeclStart()) {
      return this.parseDeclaration();
    }
    
    return this.parseStatement();
  }
  
  private isStatementKeyword(keyword: string): boolean {
    // These keywords can start a statement and should not be treated as identifiers
    return keyword === "if" || keyword === "while" || keyword === "for" ||
           keyword === "do" || keyword === "switch" || keyword === "try" ||
           keyword === "throw" || keyword === "return" || keyword === "break" ||
           keyword === "continue" || keyword === "case" || keyword === "default" ||
           keyword === "new" || keyword === "yield" || keyword === "await" ||
           keyword === "match" || keyword === "using" || keyword === "defer" ||
           keyword === "go" || keyword === "echo";
  }
  
  public isDeclStart(): boolean {
    const type = this.peek().type;
    const value = this.peek().value;
    
    // Check for decorators (@decorator)
    if (value === "@") {
      return true;
    }
    
    // Check for impl blocks (Rust-style)
    if (value === "impl" && type === TokenType.Identifier) {
      return true;
    }
    
    // Special check for using - it's only a declaration if it's an import
    if (value === "using") {
      const next = this.peekNext();
      // It's a declaration if followed by string literal or identifier (but not assignment)
      return next?.type === TokenType.StringLiteral || 
             (next?.type === TokenType.Identifier && this.peekAt(2)?.value !== "=");
    }
    
    // Check for async/unsafe followed by function declarations
    if (value === "async" || value === "unsafe") {
      const next = this.peekNext();
      return next?.value === "fn" || next?.value === "fun" || 
             next?.value === "function" || next?.value === "def" || next?.value === "func" ||
             next?.value === "async" || next?.value === "unsafe";
    }
    
    // Python-style from X import Y — only if 'import' appears soon after
    if (value === "from" && type === TokenType.Keyword) {
      // Look ahead: from <path> import ... — path can be deeply dotted
      for (let i = 1; i <= 30; i++) {
        const ahead = this.peekAt(i);
        if (!ahead || ahead.type === TokenType.EOF) break;
        if (ahead.value === "import" && ahead.type === TokenType.Keyword) return true;
        // Stop if we see operators that aren't dots, or virtual semis
        if (ahead.virtualSemi) break;
        if (ahead.type === TokenType.Operator && ahead.value !== ".") break;
      }
      return false;
    }

    // Special check for 'type' - only a declaration if followed by identifier (type alias)
    if (value === "type") {
      const next = this.peekNext();
      // It's a type declaration if the next token is an identifier
      // This allows 'type' to be used as a regular identifier in expressions
      return next?.type === TokenType.Identifier;
    }
    
    return (
      type === TokenType.Keyword && (
        value === "import" || value === "require" ||
        value === "let" || value === "var" || value === "auto" ||
        value === "fn" || value === "fun" || value === "function" || value === "def" || value === "func" ||
        value === "const" || value === "final" || value === "immutable" ||
        value === "class" || value === "struct" || value === "interface" ||
        value === "trait" || value === "enum" ||
        value === "package" || value === "export"
      ) ||
      // Also check for 'impl' as an identifier (Rust-style impl blocks)
      (type === TokenType.Identifier && value === "impl") ||
      type === TokenType.Operator && value === "#" && 
      this.peekNext()?.type === TokenType.Identifier && 
      this.peekNext()?.value === "include"
    );
  }
  
  public parseDeclaration(): AST.Decl {
    const token = this.peek();
    
    // Import statements
    if (this.match("import", "require")) {
      return Imports.parseImport(this);
    }

    // Python-style: from module import names
    if (this.peek().value === "from" && this.peek().type === TokenType.Keyword && this.isDeclStart()) {
      return Imports.parseFromImport(this);
    }

    // Check if using is for import or resource management
    if (this.peek().value === "using") {
      const next = this.peekNext();
      
      // Look ahead to distinguish import from resource management
      // Import: using "module" or using module (but not assignment)
      if (next?.type === TokenType.StringLiteral || 
          (next?.type === TokenType.Identifier && this.peekAt(2)?.value !== "=")) {
        this.advance(); // consume 'using'
        return Imports.parseImport(this);
      }
      
      // It's a using statement for resource management
      // Don't consume it, let parseStatement handle it
      throw this.error(this.peek(), "Expected declaration");
    }
    
    // #include
    if (this.check("#") && this.peekNext()?.value === "include") {
      this.advance(); // #
      this.advance(); // include
      return Imports.parseImport(this);
    }
    
    // Variable declarations
    if (this.match("let", "var", "auto")) {
      return this.parseVarDecl();
    }
    
    if (this.match("const", "final", "immutable")) {
      return this.parseConstDecl();
    }
    
    // Check for async/unsafe modifiers
    if (this.peek().value === "async" || this.peek().value === "unsafe") {
      let isAsync = false;
      let isUnsafe = false;
      
      if (this.match("async")) {
        isAsync = true;
        if (this.match("unsafe")) {
          isUnsafe = true;
        }
      } else if (this.match("unsafe")) {
        isUnsafe = true;
        if (this.match("async")) {
          isAsync = true;
        }
      }
      
      if (this.match("def", "fun", "fn", "func", "function")) {
        // Check for generator function (function*)
        const funcKeyword = this.previous()?.value;
        const isGenerator = funcKeyword === "function" && this.match("*");
        return Functions.parseFuncDecl(this, isAsync, isUnsafe, isGenerator);
      }
      
      // Not a function declaration - this would be an error
      throw this.error(this.peek(), "Expected function declaration after async/unsafe");
    }
    
    // Function declarations
    if (this.match("def", "fun", "fn", "func", "function")) {
      // Check for generator function (function*)
      const isGenerator = this.previous()?.value === "function" && this.match("*");
      return Functions.parseFuncDecl(this, false, false, isGenerator);
    }
    
    // Check for return-type-before-name function declaration
    if (Types.isType(this)) {
      const isRetTypeFn = this.attempt(() => {
        this.parseType();
        if (this.peek().type === TokenType.Identifier) {
          this.advance();
          if (this.check("(")) return true;
        }
        return null;
      });
      if (isRetTypeFn) {
        return Functions.parseFuncDeclWithReturnTypeBefore(this);
      }
    }
    
    // Type declarations
    if (this.match("type")) {
      return this.parseTypeDecl();
    }
    
    if (this.match("class")) {
      return ClassDecl.parseClassDecl(this);
    }
    
    if (this.match("interface", "trait")) {
      return ClassDecl.parseInterfaceDecl(this);
    }
    
    // Handle Rust-style impl blocks as a special class-like structure
    if (this.peek().value === "impl" && this.peek().type === TokenType.Identifier) {
      return ClassDecl.parseImplBlock(this);
    }
    
    if (this.match("enum")) {
      return ClassDecl.parseEnumDecl(this);
    }
    
    if (this.match("package")) {
      return this.parsePackageDecl();
    }
    
    if (this.match("export")) {
      return this.parseExportDecl();
    }
    
    // Check for short declaration
    if (this.peek().type === TokenType.Identifier) {
      const checkpoint = this.current;
      const id = this.advance();
      if (this.match(":=")) {
        this.current = checkpoint;
        return this.parseShortDecl();
      }
      this.current = checkpoint;
    }
    
    throw this.error(this.peek(), "Expected declaration");
  }
  
  public parseStatement(): AST.Stmt {
    // Handle async for
    if (this.peek().value === "async" && this.peekNext()?.value === "for") {
      this.advance(); // consume async
      this.advance(); // consume for
      // Now parse as a for-await loop
      return ControlFlow.parseLoop(this);
    }
    
    // Control flow
    if (this.match("if")) {
      return ControlFlow.parseIf(this);
    }
    
    if (this.check("switch")) {
      this.advance();
      return Blocks.parseSwitch(this) as AST.Stmt;
    }
    // match keyword — but not when followed by = or { (assignment or variable reference)
    if (this.check("match") && !this.isAssignmentOp(this.peekAt(1)!) && this.peekAt(1)?.value !== "{") {
      this.advance();
      return Blocks.parseSwitch(this) as AST.Stmt;
    }
    // Kotlin-style `when` as match expression
    if (this.peek().value === "when" &&
        (this.peekAt(1)?.value === "(" || this.peekAt(1)?.value === "{")) {
      this.advance(); // consume 'when'
      return Blocks.parseSwitch(this) as AST.Stmt;
    }
    
    // Bash-style case...in...esac — allowed even inside switch (distinguishes from switch case)
    if (this.peek().value === "case") {
      // Bash case: `case expr in ... esac` — detect by looking for `in` after expr
      if (!this.insideSwitch) {
        this.advance();
        return Blocks.parseCaseStatement(this);
      } else {
        // Inside a switch, only allow if it looks like bash case (has `in` or `when` nearby)
        const cp = this.current;
        this.advance(); // case
        const expr = this.parsePrimary(); // consume discriminant
        if (this.check("in") || this.check("when")) {
          this.advance(); // consume 'in' or 'when'
          return Blocks.parseCaseEsac(this, cp, expr);
        }
        // Not bash case — restore and let switch handle it
        this.current = cp;
      }
    }
    
    if (this.match("select")) {
      // Go-style select statement for channels
      return Blocks.parseSelectStatement(this);
    }
    
    if (this.match("do")) {
      // Check if this is a do-while loop or bash-style do-done
      return ControlFlow.parseDoStatement(this);
    }
    
    if (this.match("for", "while", "until", "loop")) {
      return ControlFlow.parseLoop(this);
    }
    
    if (this.match("foreach")) {
      return ControlFlow.parseForeach(this);
    }
    
    if (this.match("try")) {
      return ControlFlow.parseTry(this);
    }
    
    if (this.match("with")) {
      return ControlFlow.parseUsing(this);
    }
    
    // Check if using is for resource management
    if (this.peek().value === "using") {
      const next = this.peekNext();
      const nextNext = this.peekAt(2);

      // Resource management: using var = expr { ... } or using (Type var = expr) { ... }
      if ((next?.type === TokenType.Identifier && nextNext?.value === "=") ||
          next?.value === "(") {
        this.advance(); // consume 'using'
        return ControlFlow.parseUsing(this);
      }
    }
    
    if (this.match("defer")) {
      return ControlFlow.parseDefer(this);
    }
    
    if (this.match("break")) {
      return ControlFlow.parseBreak(this);
    }
    
    if (this.match("continue")) {
      return ControlFlow.parseContinue(this);
    }
    
    if (this.match("return")) {
      return ControlFlow.parseReturn(this);
    }
    
    if (this.match("assert")) {
      return ControlFlow.parseAssert(this);
    }
    
    if (this.match("echo", "print")) {
      return ControlFlow.parseEcho(this);
    }
    
    // New statements
    if (this.match("throw", "raise")) {
      return ControlFlow.parseThrow(this);
    }
    
    
    if (this.match("go")) {
      return ControlFlow.parseGo(this);
    }
    
    if (this.match("defer")) {
      return ControlFlow.parseDefer(this);
    }
    
    if (this.match("pass")) {
      return ControlFlow.parsePass(this);
    }
    
    // Begin/end blocks (Ruby-style with rescue/ensure)
    if (this.match("begin")) {
      return Blocks.parseBeginBlock(this);
    }
    
    // Rust `use path::to::module`, Ruby `include Module`
    if (this.peek().type === TokenType.Identifier &&
        (this.peek().value === "use" || this.peek().value === "include") &&
        this.peekAt(1) && (this.peekAt(1)!.type === TokenType.Identifier ||
                           this.peekAt(1)!.type === TokenType.StringLiteral)) {
      this.advance(); // consume 'use' or 'include'
      return Imports.parseImport(this) as any;
    }

    // Rust `mod name;` module declaration
    if (this.peek().type === TokenType.Identifier && this.peek().value === "mod" &&
        this.peekAt(1)?.type === TokenType.Identifier) {
      this.advance(); // consume 'mod'
      const modName = this.parseIdentifier();
      this.consumeSemicolon();
      return { kind: "Import", path: modName.name, span: modName.span } as any;
    }

    // Check for short declarations (Go-style :=)
    if (this.peek().type === TokenType.Identifier) {
      const checkpoint = this.current;
      this.advance();
      if (this.check(":=")) {
        this.current = checkpoint;
        return this.parseShortDecl() as any; // ShortDecl can be used as a statement
      }
      this.current = checkpoint;
    }
    
    // Block statements - but could also be object destructuring
    if (this.check("{")) {
      // Look ahead to see if this is object destructuring
      const checkpoint = this.current;
      try {
        this.advance(); // consume {
        
        // Check if it looks like object destructuring
        let isDestructuring = false;
        if (this.peek().type === TokenType.Identifier) {
          this.advance();
          if (this.check(",") || this.check("}")) {
            // Looks like {x, y} or {x}
            isDestructuring = true;
          }
        }
        
        this.current = checkpoint;
        
        if (isDestructuring) {
          // Parse as expression statement (which will parse object literal)
          return this.parseExprStmt();
        } else {
          // Parse as block
          return Blocks.parseBlock(this);
        }
      } catch {
        this.current = checkpoint;
        return Blocks.parseBlock(this);
      }
    }
    
    // Expression statement
    return this.parseExprStmt();
  }
  
  
  // Block parsing — delegated to src/parselets/blocks.ts (Chunk 9)
  public parseBlock(): AST.Block { return Blocks.parseBlock(this); }
  public parseBlockOrStatement(): AST.Block { return Blocks.parseBlockOrStatement(this); }
  public parseIndentBlock(): AST.Block { return Blocks.parseIndentBlock(this); }
  public parseKeywordBlock(keyword?: string): AST.Block { return Blocks.parseKeywordBlock(this, keyword); }
  public parseBashTestExpression(): AST.Expr { return Blocks.parseBashTestExpression(this); }
  public parseIfThenBlock(): AST.Block { return Blocks.parseIfThenBlock(this); }
  public checkIndentBlock(): boolean { return Blocks.checkIndentBlock(this); }
  public parseSwitch(): AST.Switch | AST.Match { return Blocks.parseSwitch(this); }

  // Expression parsing with Pratt parser
  public parseExpression(minPrecedence = 0): AST.Expr {
    let left = this.parsePrimary();
    
    // Check for single-parameter lambda without parentheses
    if (left.kind === "Identifier" && this.check("=>")) {
      this.advance(); // consume =>
      
      // Skip virtual semicolons after => in arrow functions
      while (this.peek().virtualSemi) {
        this.advance();
      }
      
      const body = this.check("{") ? Blocks.parseBlock(this) : this.parseAssignmentExpression();
      return {
        kind: "Lambda",
        params: [{
          name: left as AST.Identifier,
          type: undefined,
          defaultValue: undefined,
          span: left.span
        }],
        returnType: undefined,
        body,
        span: this.createSpanFrom(left)
      };
    }
    
    while (true) {
      // Skip JSX whitespace tokens if we're in a JSX context
      JSX.skipJSXWhitespace(this);
      
      const op = this.peek();
      
      // Check for 'as' type assertion (TypeScript)
      if (op.value === "as") {
        this.advance(); // consume 'as'
        const type = this.parseType();
        left = {
          kind: "TypeAssertion",
          expr: left,
          type,
          span: this.createSpanFrom(left)
        };
        continue;
      }
      
      if (!this.isBinaryOp(op) && !this.isAssignmentOp(op)) {
        break;
      }
      
      const precedence = this.getPrecedence(op);
      if (precedence < minPrecedence) {
        break;
      }
      
      this.advance();
      
      // Skip JSX whitespace after operators
      JSX.skipJSXWhitespace(this);
      
      // Skip virtual semicolons after binary operators
      while (this.peek().virtualSemi) {
        this.advance();
      }
      
      // Handle ternary operator
      if (op.value === "?") {
        JSX.skipJSXWhitespace(this);
        const consequent = this.parseExpression();
        JSX.skipJSXWhitespace(this);
        this.consume(":", "Expected ':' in ternary expression");
        JSX.skipJSXWhitespace(this);
        const alternate = this.parseExpression(precedence);
        left = {
          kind: "Ternary",
          test: left,
          consequent,
          alternate,
          span: this.createSpanFrom(left)
        };
        continue;
      }
      
      const isRightAssoc = this.isRightAssociative(op);
      const nextMinPrec = isRightAssoc ? precedence : precedence + 1;
      
      // Special case: pipe operator followed by match expression
      let right: AST.Expr;
      if (op.value === "|>" && this.check("match")) {
        // Parse match with implicit discriminant (left side of pipe)
        this.advance(); // consume 'match'
        const switchStmt = Blocks.parseSwitch(this);
        // For now, treat it as an expression (would need AST changes for proper support)
        right = switchStmt as any;
      } else {
        right = this.parseExpression(nextMinPrec);
      }
      
      if (this.isAssignmentOp(op)) {
        left = {
          kind: "Assign",
          op: op.value,
          left,
          right,
          span: this.createSpanFrom(left)
        };
      } else {
        left = {
          kind: "Binary",
          op: op.value,
          left,
          right,
          span: this.createSpanFrom(left)
        };
      }
    }
    
    return left;
  }
  
  public parsePrimary(): AST.Expr {
    // Handle function expressions (including async)
    // But not when func() looks like a function call (no body follows the parens)
    if ((this.peek().value === "function" || this.peek().value === "func") &&
        !this.looksLikeFuncCall()) {
      const start = this.current;
      this.advance(); // consume 'function' or 'func'

      // Check for generator function*
      const isGenerator = this.match("*");

      // Function expressions can be anonymous
      let name: AST.Identifier | undefined = undefined;
      if (this.peek().type === TokenType.Identifier) {
        name = this.parseIdentifier();
      }

      // Parse parameters
      const params = Functions.parseParameterList(this);

      // Parse return type if present
      let returnType: AST.TypeNode | undefined = undefined;
      if (this.match(":")) {
        returnType = this.parseType();
      }

      // Parse body
      const body = Blocks.parseBlock(this);

      // Return as a Lambda expression (anonymous function)
      // Allow postfix operations (like IIFE calls: func(){}())
      const lambda: AST.Expr = {
        kind: "Lambda",
        params,
        returnType,
        body,
        span: this.createSpan(start, this.current - 1)
      };
      if (isGenerator) (lambda as any).generator = true;
      return this.parsePostfix(lambda);
    }
    
    // Handle async lambda/function expressions
    if (this.peek().value === "async") {
      // Look ahead to see if this is really an async function/lambda
      const next = this.peekNext();
      const isAsyncFunction = next && (
        next.value === "(" ||  // async () => 
        next.value === "{" ||  // async { ... }
        next.value === "move" || // async move { ... } (Rust-style)
        (next.type === TokenType.Identifier && this.peekAt(2)?.value === "=>") || // async x =>
        next.value === "function" // async function
      );
      
      if (isAsyncFunction) {
        this.advance(); // consume 'async'
        const start = this.current - 1;
        
        // Check for async function expression
        if (this.match("function")) {
          // Parse async function expression
          const isGenerator = this.match("*");
          
          // Function expressions can be anonymous
          let name: AST.Identifier | undefined = undefined;
          if (this.peek().type === TokenType.Identifier) {
            name = this.parseIdentifier();
          }
          
          // Parse parameters
          const params = Functions.parseParameterList(this);
          
          // Parse return type if present
          let returnType: AST.TypeNode | undefined = undefined;
          if (this.match(":")) {
            returnType = this.parseType();
          }
          
          // Parse body
          const body = Blocks.parseBlock(this);
          
          // Return as an async Lambda expression
          const lambda: any = {
            kind: "Lambda",
            params,
            returnType,
            body,
            span: this.createSpan(start, this.current - 1)
          };
          lambda.async = true;
          if (isGenerator) lambda.generator = true;
          return lambda;
        }
        
        // Check for 'move' keyword (Rust-style async move block)
        const hasMove = this.match("move");
        
        // Check for lambda or async block
        if (this.check("(") || this.peek().type === TokenType.Identifier || this.check("{")) {
          // Parse as async lambda or async block
          const lambda = Functions.parseAsyncLambda(this, start);
          // Mark if it has move semantics
          if (hasMove) {
            (lambda as any).move = true;
          }
          // Allow postfix operations on the lambda (like calls)
          return this.parsePostfix(lambda);
        }
        // Otherwise it's an error
        throw this.error(this.peek(), "Expected lambda or block after async");
      }
      // Otherwise, treat 'async' as a regular identifier
    }
    
    // Handle yield expression
    if (this.match("yield")) {
      return ControlFlow.parseYieldExpression(this);
    }
    
    // Handle channel receive operator
    if (this.check("<-")) {
      const op = this.advance();
      const argument = this.parsePrimary();
      return {
        kind: "Unary",
        op: "<-",
        argument,
        prefix: true,
        span: this.createSpan(this.current - 1, this.current)
      };
    }
    
    // Handle JSX elements and fragments (spec 10.6)
    const token = this.peek();
    if (token.type === TokenType.JSXTagStart || token.value === "<") {
      // Check if we're in a valid JSX expression context
      if (JSX.isInJSXExpressionContext(this)) {
        const next = this.peekNext();

        // Check for JSX fragment <>
        if (next && next.value === ">") {
          return JSX.parseJSXFragment(this);
        }

        // Check for JSX closing tag </
        if (next && next.value === "/") {
          // This shouldn't happen in primary expression position
          throw this.error(this.peek(), "Unexpected JSX closing tag");
        }

        // Check if this looks like JSX element using new disambiguation
        if (next && (next.type === TokenType.Identifier || next.value === ">")) {
          if (JSX.isJSXElement(this)) {
            return JSX.parseJSXElement(this);
          }
        }
      }
      
      // Not JSX - try other interpretations
      const next = this.peekNext();
      if (next && next.type === TokenType.Identifier) {
        // Try type assertion or generic parsing
        
        // Try type assertion <Type>expr
        const checkpoint = this.current;
        this.advance(); // consume '<'
        
        // Try to parse a type (which could be a complex generic type)
        try {
          const type = this.parseType();
          
          // Look for closing '>' - for generic types, this is already consumed
          // For simple types, we need to consume it
          // Also handle >> token that might remain after generic parsing
          if (this.peek().value === ">") {
            this.advance();
          } else if (this.peek().value === ">>") {
            // Split >> into two > tokens for proper handling
            this.advance(); // consume >>
            // Inject a synthetic > token back
            const syntheticToken = { ...this.tokens[this.current - 1] };
            syntheticToken.value = ">";
            this.tokens.splice(this.current, 0, syntheticToken);
          }
          
          // Now we should have a complete type, parse the expression
          // But first check we're at a valid position for an expression
          if (this.isAtEnd() || this.peek().type === TokenType.EOF) {
            throw new Error("Expected expression after type assertion");
          }
          const expr = this.parsePrimary();
          
          return {
            kind: "TypeAssertion",
            expr,
            type,
            span: this.createSpan(checkpoint, this.current - 1)
          };
        } catch (e) {
          // Not a valid type assertion, restore position
          this.current = checkpoint;
          // Re-throw if it's not a parsing error we can recover from
          if (e instanceof Error && e.message && !e.message.includes("Unexpected")) {
            throw e;
          }
        }
      }
    }
    
    // Handle prefix operators
    if (this.isUnaryOp(this.peek())) {
      const op = this.advance();
      const argument = this.parsePrimary();
      return {
        kind: "Unary",
        op: op.value,
        argument,
        prefix: true,
        span: this.createSpan(this.current - 1, this.current)
      };
    }
    
    // Literals
    if (this.peek().type === TokenType.NumericLiteral) {
      return Literals.parseNumericLiteral(this);
    }
    
    if (this.peek().type === TokenType.StringLiteral) {
      return Literals.parseStringLiteral(this);
    }
    
    if (this.peek().type === TokenType.TemplateLiteral) {
      // Check if this should be reinterpreted as an identifier
      if (this.shouldReinterpretAsIdentifier()) {
        return this.parseBacktickIdentifier();
      }
      return Literals.parseTemplateLiteral(this);
    }
    
    if (this.peek().type === TokenType.RegexLiteral) {
      return this.parsePostfix(Literals.parseRegexLiteral(this));
    }
    
    if (this.match("true", "false")) {
      const token = this.previous();
      return {
        kind: "BooleanLiteral",
        value: token?.value === "true",
        span: this.createSpanFrom(token!)
      };
    }
    
    if (this.match("null", "undefined", "nil")) {
      return {
        kind: "NullLiteral",
        span: this.createSpanFrom(this.previous()!)
      };
    }
    
    // this and super keywords
    if (this.match("this", "super")) {
      const token = this.previous()!;
      const id: AST.Identifier = {
        kind: "Identifier",
        name: token.value,
        span: this.createSpanFrom(token)
      };
      return this.parsePostfix(id);
    }
    
    // Runtime tag expressions: @py(expr), @js(expr), @go(expr), @rb(expr), @java(expr)
    if (this.check("@")) {
      const runtimeNames = ["py", "js", "go", "rb", "java"];
      const nextToken = this.peekNext();
      if (nextToken && runtimeNames.includes(nextToken.value)) {
        const runtimeTag = this.attempt(() => {
          const tagStart = this.current;
          this.advance(); // consume @
          const runtimeName = this.advance(); // consume runtime name
          if (!this.check("(")) return null;
          this.advance(); // consume (
          const expr = this.parseExpression();
          this.consume(")", "Expected ')' after runtime-tagged expression");
          return this.parsePostfix({
            kind: "RuntimeTag",
            runtime: runtimeName.value as AST.RuntimeTag["runtime"],
            expr,
            span: this.createSpan(tagStart, this.current - 1)
          });
        });
        if (runtimeTag) return runtimeTag;
      }
    }

    // Kotlin-style `when` as match expression
    if (this.peek().value === "when" &&
        (this.peekAt(1)?.value === "(" || this.peekAt(1)?.value === "{")) {
      this.advance(); // consume 'when'
      const switchExpr = Blocks.parseSwitch(this);
      return switchExpr as any;
    }

    // Go composite literals: map[K]V{...}, []Type{...}
    if (this.check("map") && this.peekAt(1)?.value === "[") {
      return this.parsePostfix(this.parseGoCompositeLiteral());
    }
    if (this.check("[") && this.peekAt(1)?.value === "]" &&
        (this.peekAt(2)?.type === TokenType.Identifier ||
         (this.peekAt(2)?.type === TokenType.Keyword &&
          ["map", "interface", "struct", "chan"].includes(this.peekAt(2)?.value || "")))) {
      // Only parse as Go slice literal if { follows the type (lookahead to confirm)
      const checkpoint = this.current;
      try {
        this.advance(); // [
        this.advance(); // ]
        // For simple identifiers (byte, int, string, etc.), just skip one token
        // to avoid parseType() over-consuming the following '(' as function type params
        if (this.peek().type === TokenType.Identifier) {
          this.advance();
        } else {
          Types.parseGoTypeAnnotation(this); // handle map[K]V, interface{}, etc.
        }
        if (this.check("{") || this.check("(")) {
          this.current = checkpoint;
          return this.parsePostfix(this.parseGoCompositeLiteral());
        }
      } catch {}
      this.current = checkpoint;
    }

    // Identifiers and sigil identifiers
    // Also allow keywords as identifiers in expression context when they can't start a statement
    if (this.peek().type === TokenType.Identifier ||
        this.peek().type === TokenType.SigilIdentifier ||
        (this.peek().type === TokenType.Keyword && !this.isStatementKeyword(this.peek().value))) {
      const token = this.peek();
      let id: AST.Identifier;
      
      if (token.type === TokenType.Keyword) {
        // Keywords used as identifiers
        this.advance();
        id = {
          kind: "Identifier",
          name: token.value,
          span: this.createSpanFrom(token)
        };
      } else {
        id = this.parseIdentifier();
      }
      
      // Check for generic type arguments only in specific contexts
      // Per spec: generics only when < follows identifier with NO whitespace
      if (this.peek().value === "<" && !this.hasWhitespaceBefore()) {
        const next = this.peekNext();
        // Only try to parse generics if not followed by a number or obvious non-type token
        if (next && next.type !== TokenType.NumericLiteral && 
            next.type === TokenType.Identifier) {
          const genericArgs = this.tryParseGenericArgs();
          if (genericArgs) {
            // Store generic arguments for potential call expression
            // This will be picked up by parsePostfix if followed by ()
            (id as any)._genericArgs = genericArgs;
          }
        }
      }
      
      return this.parsePostfix(id);
    }
    
    // Parenthesized expression, lambda, or generator comprehension
    if (this.match("(")) {
      // Check if this is a lambda parameter list
      const checkpoint = this.current;
      const isLambda = Functions.checkParenthesizedLambda(this);
      this.current = checkpoint;
      
      if (isLambda) {
        return Functions.parseLambda(this);
      }
      
      const start = this.current - 1;
      
      // Skip virtual semicolons and JSX whitespace after opening parenthesis
      while (this.peek().virtualSemi) {
        this.advance();
      }
      JSX.skipJSXWhitespace(this);
      
      const expr = this.parseExpression();
      
      // Skip virtual semicolons and JSX whitespace before closing parenthesis
      while (this.peek().virtualSemi) {
        this.advance();
      }
      JSX.skipJSXWhitespace(this);
      
      // Check for generator comprehension: (expr for var in iterable)
      if (this.check("for")) {
        return Literals.parseGeneratorComprehension(this, expr, start);
      }
      
      this.must(")", { recoverWithSynthetic: true });
      return this.parsePostfix(expr);
    }
    
    // Array literal
    if (this.match("[")) {
      return this.parsePostfix(Literals.parseArrayLiteral(this));
    }

    // Object literal
    if (this.match("{")) {
      return this.parsePostfix(Literals.parseObjectLiteral(this));
    }
    
    // Lambda/arrow function
    if (Functions.checkLambda(this)) {
      return Functions.parseLambda(this);
    }
    
    // new expression
    if (this.match("new")) {
      return this.parseNewExpression();
    }
    
    // throw expression (JavaScript/TypeScript)
    if (this.match("throw")) {
      const start = this.current - 1;
      const argument = this.parseExpression();
      return {
        kind: "Unary",
        op: "throw",
        argument,
        prefix: true,
        span: this.createSpan(start, this.current - 1)
      };
    }
    
    // match expression — but not when followed by assignment (e.g. match = str =~ rx)
    // or { (e.g. if match { ... } where match is a variable name used as condition)
    if (this.check("match") && !this.isAssignmentOp(this.peekAt(1)!) && this.peekAt(1)?.value !== "{") {
      this.advance();
      const switchExpr = Blocks.parseSwitch(this);
      return switchExpr as any;
    }
    // match as identifier (assignment target or variable reference)
    if (this.check("match")) {
      const token = this.advance();
      const id: AST.Identifier = {
        kind: "Identifier",
        name: token.value,
        span: this.createSpanFrom(token)
      };
      return this.parsePostfix(id);
    }

    // Ruby symbol literals: :identifier or :keyword
    if (this.check(":") && !this.check("::")) {
      const next = this.peekAt(1);
      if (next && (next.type === TokenType.Identifier || next.type === TokenType.Keyword)) {
        const start = this.current;
        this.advance(); // consume ':'
        const name = this.advance(); // consume identifier/keyword
        return this.parsePostfix({
          kind: "StringLiteral",
          parts: [{ kind: "Text", value: ":" + name.value }],
          flags: {},
          delimiter: ":",
          span: this.createSpan(start, this.current - 1)
        });
      }
    }

    // Ruby percent literals: %r{pattern}flags, %w{word list}, %i{symbol list}
    if (this.check("%")) {
      const next = this.peekAt(1);
      if (next && next.type === TokenType.Identifier && /^[rwiqQxs]$/.test(next.value)) {
        const nextNext = this.peekAt(2);
        if (nextNext && (nextNext.value === "{" || nextNext.value === "[" || nextNext.value === "(")) {
          const start = this.current;
          this.advance(); // consume '%'
          const kind = this.advance(); // consume letter (r, w, etc.)
          const open = this.advance(); // consume opening delimiter
          const close = open.value === "{" ? "}" : open.value === "[" ? "]" : ")";
          // Consume content until matching close delimiter
          let depth = 1;
          while (!this.isAtEnd() && depth > 0) {
            if (this.peek().value === open.value) depth++;
            else if (this.peek().value === close) depth--;
            if (depth > 0) this.advance();
          }
          if (!this.isAtEnd()) this.advance(); // consume closing delimiter
          // Consume optional trailing flags (e.g., 'i', 'g', 'mix')
          if (!this.isAtEnd() && this.peek().type === TokenType.Identifier &&
              /^[igmxsue]+$/.test(this.peek().value)) {
            this.advance();
          }
          return {
            kind: "RegexLiteral",
            pattern: "%" + kind.value + open.value + "..." + close,
            flags: "",
            span: this.createSpan(start, this.current - 1)
          } as any;
        }
      }
    }

    throw this.error(this.peek(), "Unexpected token in expression");
  }
  
  private parsePostfix(expr: AST.Expr): AST.Expr {
    // Note: Generic arguments are now parsed in parsePrimary and attached to the identifier
    // They will be in expr._genericArgs if present
    
    while (true) {
      // Check for generic arguments after member access (e.g., React.forwardRef<T1, T2>)
      // This handles cases where generics appear after a member access operation
      if (this.check("<") && !this.check("<-") && !this.check("<<") && !this.check("<=") && expr.kind === "Member") {
        // Skip if next token after < is a numeric literal — definitely a comparison
        const afterLt = this.peekAt(1);
        if (afterLt && afterLt.type === TokenType.NumericLiteral) {
          // Fall through to binary operator handling below
        } else {
        const checkpoint = this.current;
        const genericArgs = this.tryParseGenericArgs();
        
        if (genericArgs) {
          // Store generic arguments for the next call expression
          (expr as any)._genericArgs = genericArgs;
        } else {
          // Not generic arguments, restore position
          this.current = checkpoint;
        }
        }
      }
      
      // Function call
      if (this.match("(")) {
        // Special case for make() with Go types (channels, slices, maps)
        if (expr.kind === "Identifier" && expr.name === "make") {
          // Check if the next token suggests a Go type
          if (this.check("<-") || this.peek().value === "chan" ||
              (this.check("[") && this.peekAt(1)?.value === "]") ||
              this.peek().value === "map") {
            // Use parseGoTypeAnnotation for Go-specific types (slices, maps)
            // Use parseType for chan (supports angle bracket generics like chan<T>)
            const useGoType = (this.check("[") && this.peekAt(1)?.value === "]") || this.peek().value === "map";
            const typeNode = useGoType ? Types.parseGoTypeAnnotation(this) : this.parseType();
            
            // If it's a GenericType with chan base, keep it as a structured expression
            let typeExpr: AST.Expr;
            if (typeNode.kind === "GenericType" && typeNode.base.name === "chan") {
              // Keep the GenericType structure accessible by wrapping in a special node
              // For now, we'll still convert to string but mark it specially
              typeExpr = {
                kind: "Identifier",
                name: Types.typeNodeToString(typeNode),
                originalSpelling: Types.typeNodeToString(typeNode),
                span: typeNode.span,
                // Store the original type info in a non-standard field for test access
                _typeNode: typeNode
              } as any;
            } else {
              typeExpr = {
                kind: "Identifier",
                name: Types.typeNodeToString(typeNode),
                originalSpelling: Types.typeNodeToString(typeNode),
                span: typeNode.span
              };
            }
            
            // Handle optional size/capacity arguments
            const args: AST.Expr[] = [typeExpr];
            while (this.match(",")) {
              args.push(this.parseAssignmentExpression());
            }
            
            this.must(")", { recoverWithSynthetic: true });
            
            // Create the Call node, and if we have a GenericType, store it
            const callExpr: AST.Call = {
              kind: "Call",
              callee: expr,
              args,
              span: this.createSpanFrom(expr)
            };
            
            // Store the type node in a non-standard field for test access
            if ((typeExpr as any)._typeNode) {
              (callExpr as any)._typeNode = (typeExpr as any)._typeNode;
            }
            
            expr = callExpr;
            continue;
          }
        }
        
        const args = this.parseArguments();
        this.must(")", { recoverWithSynthetic: true });
        
        // Check if we have stored generic arguments
        const genericArgs = (expr as any)._genericArgs;
        
        const callExpr: AST.Call = {
          kind: "Call",
          callee: expr,
          args,
          span: this.createSpanFrom(expr)
        };
        
        // Add generic arguments if they exist
        if (genericArgs) {
          (callExpr as any).genericArgs = genericArgs;
          // Clean up the temporary storage
          delete (expr as any)._genericArgs;
        }
        
        expr = callExpr;
        
        // Check for Ruby block after function call
        if (this.check("do") && !this.noRubyBlock) {
          const blockStart = this.current;
          this.advance(); // consume 'do'
          
          // Parse block parameters if present |x, y|
          let blockParams: AST.Identifier[] = [];
          if (this.match("|")) {
            do {
              blockParams.push(this.parseIdentifier());
            } while (this.match(","));
            this.consume("|", "Expected '|' after block parameters");
          }
          
          // Parse block body until 'end' or 'done'
          const blockStatements: (AST.Stmt | AST.Decl)[] = [];
          while (!this.isAtEnd() && this.peek().value !== "end" && this.peek().value !== "done") {
            if (this.peek().virtualSemi) {
              this.advance();
              continue;
            }

            const stmt = this.parseStatement();
            if (stmt) blockStatements.push(stmt);
          }

          if (!this.match("end") && !this.match("done")) {
            this.consume("end", "Expected 'end' to close Ruby block");
          }

          // Add block as a special property on the call (not in standard AST)
          (callExpr as any).rubyBlock = {
            params: blockParams,
            body: blockStatements,
            span: this.createSpan(blockStart, this.current - 1)
          };
        }

        continue;
      }

      // Check for Ruby block after member access (Ruby method calls without parens)
      // e.g., items.each do |item| ... end
      if (this.check("do") && expr.kind === "Member" && !this.noRubyBlock) {
        // Convert the member access to a call with no arguments
        const callExpr: AST.Call = {
          kind: "Call",
          callee: expr,
          args: [],
          span: expr.span
        };

        const blockStart = this.current;
        this.advance(); // consume 'do'

        // Parse block parameters if present |x, y|
        let blockParams: AST.Identifier[] = [];
        if (this.match("|")) {
          do {
            blockParams.push(this.parseIdentifier());
          } while (this.match(","));
          this.consume("|", "Expected '|' after block parameters");
        }

        // Parse block body until 'end' or 'done'
        const blockStatements: (AST.Stmt | AST.Decl)[] = [];
        while (!this.isAtEnd() && this.peek().value !== "end" && this.peek().value !== "done") {
          if (this.peek().virtualSemi) {
            this.advance();
            continue;
          }

          const stmt = this.parseStatement();
          if (stmt) blockStatements.push(stmt);
        }

        if (!this.match("end") && !this.match("done")) {
          this.consume("end", "Expected 'end' to close Ruby block");
        }
        
        // Add block as a special property on the call
        (callExpr as any).rubyBlock = {
          params: blockParams,
          body: blockStatements,
          span: this.createSpan(blockStart, this.current - 1)
        };
        
        expr = callExpr;
        continue;
      }
      
      // Ruby block with curly braces: expr { |x, y| body }
      // Only when { is followed by | (to disambiguate from object literals/blocks)
      if (this.check("{") && this.peekNext()?.value === "|" && !this.noRubyBlock &&
          (expr.kind === "Call" || expr.kind === "Member" || expr.kind === "Identifier")) {
        // Convert to call if needed
        let callExpr: AST.Call;
        if (expr.kind === "Call") {
          callExpr = expr as AST.Call;
        } else {
          callExpr = {
            kind: "Call",
            callee: expr,
            args: [],
            span: expr.span
          };
        }

        const blockStart = this.current;
        this.advance(); // consume '{'

        // Parse block parameters |x, y|
        let blockParams: AST.Identifier[] = [];
        if (this.match("|")) {
          do {
            blockParams.push(this.parseIdentifier());
          } while (this.match(","));
          this.consume("|", "Expected '|' after block parameters");
        }

        // Parse block body until '}'
        const blockStatements: (AST.Stmt | AST.Decl)[] = [];
        while (!this.isAtEnd() && !this.check("}")) {
          if (this.peek().virtualSemi) {
            this.advance();
            continue;
          }

          const stmt = this.parseStatement();
          if (stmt) blockStatements.push(stmt);
        }

        this.consume("}", "Expected '}' to close Ruby block");

        (callExpr as any).rubyBlock = {
          params: blockParams,
          body: blockStatements,
          span: this.createSpan(blockStart, this.current - 1)
        };

        expr = callExpr;
        continue;
      }

      // Member access and optional chaining
      // Check for ?. first to handle both ?.property and ?.[index]
      if (this.peek().value === "?.") {
        const next = this.peekNext();
        if (next?.value === "[") {
          // Optional chaining with bracket notation (?.[)
          this.advance(); // consume ?.
          this.advance(); // consume [
          const index = this.parseExpression();
          this.consume("]", "Expected ']' after index");
          expr = {
            kind: "Index",
            object: expr,
            index,
            optional: true,
            span: this.createSpanFrom(expr)
          };
          continue;
        } else if (next && next.type === TokenType.Identifier) {
          // Optional chaining with property access (?.property)
          this.advance(); // consume ?.
          const property = this.parseIdentifier();
          expr = {
            kind: "Member",
            object: expr,
            property,
            optional: true,
            span: this.createSpanFrom(expr)
          };
          continue;
        }
        // If ?. is not followed by [ or identifier, don't consume it
        // This might be an error or part of something else
      }
      
      // Regular index access
      if (this.match("[")) {
        const index = this.parseExpression();
        this.consume("]", "Expected ']' after index");
        expr = {
          kind: "Index",
          object: expr,
          index,
          optional: false,
          span: this.createSpanFrom(expr)
        };
        continue;
      }
      
      // Scope resolution operator (C++/Rust style)
      if (this.match("::")) {
        // After ::, keywords can be used as identifiers
        const next = this.peek();
        let property: AST.Identifier;
        
        if (next.type === TokenType.Identifier || next.type === TokenType.Keyword) {
          property = {
            kind: "Identifier",
            name: next.value,
            originalSpelling: next.value,
            span: this.createSpan(this.current, this.current)
          };
          this.advance();
        } else {
          property = this.parseIdentifier();
        }
        
        expr = {
          kind: "Member",
          object: expr,
          property,
          computed: false,
          optional: false,
          span: this.createSpanFrom(expr)
        };
        continue;
      }
      
      // Regular member access (including pointer dereference, force unwrap, and PHP arrow)
      if (this.match(".", ".*", "!.", "->")) {
        const op = this.previous()?.value;
        const deref = op === ".*";
        const forceUnwrap = op === "!.";
        const phpArrow = op === "->";
        
        // Special case for .*. pattern (pointer member access)
        if (deref && this.match(".")) {
          const property = this.parseIdentifier();
          // Create a compound member access: (*obj).field
          expr = {
            kind: "Member",
            object: {
              kind: "Unary",
              op: "*",
              argument: expr,
              prefix: true,
              span: expr.span
            },
            property,
            optional: false,
            span: this.createSpanFrom(expr)
          };
        } else if (!deref) {
          // Check for .await syntax (Rust-style)
          if (this.peek().value === "await") {
            this.advance(); // consume await
            expr = {
              kind: "Unary",
              op: "await",
              argument: expr,
              prefix: false,
              span: this.createSpanFrom(expr)
            };
            continue;
          }

          // Go type assertion: expr.(Type) or expr.(type)
          if (this.check("(")) {
            this.advance(); // consume (
            if (this.check("type")) {
              // Go type switch: expr.(type)
              this.advance(); // consume 'type'
              this.consume(")", "Expected ')' after type assertion");
              expr = {
                kind: "TypeAssertion",
                expr,
                type: {
                  kind: "SimpleType",
                  id: { kind: "Identifier", name: "type", span: this.createSpanFrom(expr) },
                  span: this.createSpanFrom(expr)
                } as AST.TypeNode,
                span: this.createSpanFrom(expr)
              };
            } else {
              // Go type assertion: expr.(ConcreteType)
              const type = Types.parseGoTypeAnnotation(this);
              this.consume(")", "Expected ')' after type assertion");
              expr = {
                kind: "TypeAssertion",
                expr,
                type,
                span: this.createSpanFrom(expr)
              };
            }
            continue;
          }

          // Regular member access, force unwrap, or PHP arrow
          const property = this.parseIdentifier();
          
          // If it was force unwrap, wrap the object in a non-null assertion
          if (forceUnwrap) {
            expr = {
              kind: "Member",
              object: {
                kind: "Unary",
                op: "!",
                argument: expr,
                prefix: false,
                span: expr.span
              },
              property,
              optional: false,
              span: this.createSpanFrom(expr)
            };
          } else {
            // Regular member access (. or ->)
            expr = {
              kind: "Member",
              object: expr,
              property,
              optional: false,
              span: this.createSpanFrom(expr)
            };
          }
        }
        continue;
      } else if (this.check(".") && this.peekNext()?.value === "*") {
        // Handle case where .* was lexed as two separate tokens
        this.advance(); // consume .
        this.advance(); // consume *
        if (this.match(".")) {
          const property = this.parseIdentifier();
          // Create a compound member access: (*obj).field
          expr = {
            kind: "Member",
            object: {
              kind: "Unary",
              op: "*",
              argument: expr,
              prefix: true,
              span: expr.span
            },
            property,
            optional: false,
            span: this.createSpanFrom(expr)
          };
        } else {
          // Just pointer dereference
          expr = {
            kind: "Unary",
            op: "*",
            argument: expr,
            prefix: true,
            span: this.createSpanFrom(expr)
          };
        }
        continue;
      }
      
      // Postfix increment/decrement
      if (this.match("++", "--")) {
        const op = this.previous();
        expr = {
          kind: "Unary",
          op: op?.value || "",
          argument: expr,
          prefix: false,
          span: this.createSpanFrom(expr)
        };
        continue;
      }
      
      // Non-null assertion operator (TypeScript)
      if (this.check("!")) {
        const next = this.peekNext();
        if (!next || !this.isUnaryOp(next)) {
          // Only treat ! as postfix if not followed by another unary operator
          this.advance(); // consume !
          expr = {
            kind: "Unary",
            op: "!",
            argument: expr,
            prefix: false,
            span: this.createSpanFrom(expr)
          };
          continue;
        }
      }
      
      // Try operator (Rust) - only at end of expression or before certain tokens
      if (this.check("?")) {
        const next = this.peekNext();
        // Treat as postfix ? if followed by:
        // - End of statement (; or newline)
        // - Closing bracket/paren
        // - Comma
        // - Binary operators (but not :)
        const isPostfix = !next ||
                         next.type === TokenType.EOF ||
                         next.value === ";" ||
                         next.value === ")" ||
                         next.value === "]" ||
                         next.value === "}" ||
                         next.value === "," ||
                         next.virtualSemi ||
                         (this.isBinaryOp(next) && next.value !== ":" && next.value !== "<") ||
                         (next.type === TokenType.Keyword && this.isStatementKeyword(next.value));
        
        if (isPostfix) {
          this.advance(); // consume ?
          expr = {
            kind: "Unary",
            op: "?",
            argument: expr,
            prefix: false,
            span: this.createSpanFrom(expr)
          };
          continue;
        }
      }
      
      break;
    }
    
    return expr;
  }
  
  // Helper methods for specific constructs
  private parseVarDecl(): AST.VarDecl {
    const start = this.current - 1;

    // Rust-style: let mut x = ...
    if (this.peek().value === "mut") {
      this.advance(); // skip 'mut'
    }

    // Go grouped var: var ( name = value \n name2 = value2 )
    if (this.check("(")) {
      this.advance(); // consume '('
      const allNames: AST.Identifier[] = [];
      const allValues: AST.Expr[] = [];
      while (!this.check(")") && !this.isAtEnd()) {
        while (this.peek().virtualSemi) this.advance();
        if (this.check(")")) break;
        const name = this.parseIdentifier();
        allNames.push(name);
        if (this.match("=")) {
          allValues.push(this.parseAssignmentExpression());
        }
        while (this.peek().virtualSemi) this.advance();
      }
      this.consume(")", "Expected ')' after grouped var declarations");
      this.consumeSemicolon();
      return {
        kind: "VarDecl",
        names: allNames,
        values: allValues.length > 0 ? allValues : undefined,
        span: this.createSpan(start, this.current - 1)
      };
    }

    const names = this.parseIdentifierList();
    
    let type: AST.TypeNode | undefined;
    if (this.match(":")) {
      type = this.parseType();
    }
    
    let values: AST.Expr[] | undefined;
    if (this.match("=")) {
      values = this.parseExpressionList();
    }
    
    this.consumeSemicolon();
    
    return {
      kind: "VarDecl",
      names,
      type,
      values,
      span: this.createSpan(start, this.current - 1)
    };
  }
  
  private parseConstDecl(): AST.ConstDecl {
    const start = this.current - 1;
    const names = this.parseIdentifierList();
    
    let type: AST.TypeNode | undefined;
    if (this.match(":")) {
      type = this.parseType();
    }
    
    this.consume("=", "Const declaration requires initialization");
    const values = this.parseExpressionList();
    
    this.consumeSemicolon();
    
    return {
      kind: "ConstDecl",
      names,
      type,
      values,
      span: this.createSpan(start, this.current - 1)
    };
  }
  
  private peekAhead(value: string): boolean {
    // Look ahead to see if a specific token appears after destructuring pattern
    const checkpoint = this.current;
    let depth = 0;
    
    // Skip the destructuring pattern
    if (this.peek().value === "{" || this.peek().value === "[") {
      const openBracket = this.peek().value;
      const closeBracket = openBracket === "{" ? "}" : "]";
      this.advance();
      depth = 1;
      
      while (depth > 0 && !this.isAtEnd()) {
        if (this.peek().value === openBracket) depth++;
        else if (this.peek().value === closeBracket) depth--;
        this.advance();
      }
      
      // Check if the next token is what we're looking for
      const found = this.peek().value === value;
      this.current = checkpoint;
      return found;
    }
    
    this.current = checkpoint;
    return false;
  }
  
  private parseDestructuringShortDecl(): AST.ShortDecl {
    const start = this.current;
    
    // Parse the destructuring pattern
    const pattern = this.parseDestructuringPattern();
    
    this.consume(":=", "Expected ':=' in destructuring declaration");
    
    const value = this.parseExpression();
    
    this.consumeSemicolon();
    
    return {
      kind: "ShortDecl",
      targets: [pattern],
      value,
      span: this.createSpan(start, this.current - 1)
    };
  }
  
  private parseShortDecl(): AST.ShortDecl {
    const start = this.current;
    const targets: (AST.Identifier | AST.ArrayPattern | AST.ObjectPattern)[] = [];
    
    // Parse targets (can be identifiers or destructuring patterns)
    do {
      if (this.check("[") || this.check("{")) {
        // Destructuring pattern
        targets.push(this.parseDestructuringPattern());
      } else if (this.peek().type === TokenType.Identifier) {
        // Simple identifier
        targets.push(this.parseIdentifier());
      } else {
        throw this.error(this.peek(), "Expected identifier or destructuring pattern");
      }
    } while (this.match(","));
    
    this.consume(":=", "Expected ':=' in short declaration");
    
    // Parse the value expression
    const value = this.parseExpression();
    
    this.consumeSemicolon();
    
    // If it's a simple single-identifier case, use the old format for compatibility
    if (targets.length === 1 && targets[0].kind === "Identifier") {
      return {
        kind: "ShortDecl",
        pairs: [{ name: targets[0], expr: value }],
        span: this.createSpan(start, this.current - 1)
      };
    }
    
    // For destructuring or multiple targets
    return {
      kind: "ShortDecl",
      targets,
      value,
      span: this.createSpan(start, this.current - 1)
    };
  }
  

  /**
   * Parse a Go composite literal: map[K]V{...}, []Type{...}, Type{...}
   * Returns an ObjectLiteral (for map) or ArrayLiteral (for slice) node.
   */
  private parseGoCompositeLiteral(): AST.Expr {
    const start = this.current;
    // Parse the Go type
    const goType = Types.parseGoTypeAnnotation(this);

    // If followed by { ... }, parse the composite literal body
    if (this.check("{")) {
      this.advance(); // consume {
      // Skip virtual semicolons
      while (this.peek().virtualSemi) this.advance();

      // Check if this is a map-like type (has key-value pairs) or slice-like (has values)
      const entries: AST.ObjectProperty[] = [];
      const elements: AST.Expr[] = [];
      let isMap = false;

      while (!this.check("}") && !this.isAtEnd()) {
        while (this.peek().virtualSemi) this.advance();
        if (this.check("}")) break;

        const expr = this.parseAssignmentExpression();

        if (this.match(":")) {
          // key: value pair (map literal)
          isMap = true;
          const value = this.parseAssignmentExpression();
          entries.push({
            key: expr,
            value,
            span: this.createSpanFrom(expr)
          });
        } else {
          // Just a value (slice literal)
          elements.push(expr);
        }

        this.match(","); // optional trailing comma
        while (this.peek().virtualSemi) this.advance();
      }
      this.consume("}", "Expected '}' in Go composite literal");

      if (isMap || entries.length > 0) {
        return {
          kind: "ObjectLiteral",
          properties: entries,
          span: this.createSpan(start, this.current - 1)
        } as AST.ObjectLiteral;
      } else {
        return {
          kind: "ArrayLiteral",
          elements,
          span: this.createSpan(start, this.current - 1)
        } as AST.ArrayLiteral;
      }
    }

    // No { after type — treat as a type conversion: []byte(data) etc.
    // Parse it as a call-like expression
    if (this.check("(")) {
      this.advance(); // consume (
      const args: AST.Expr[] = [];
      if (!this.check(")")) {
        do {
          args.push(this.parseExpression());
        } while (this.match(","));
      }
      this.consume(")", "Expected ')' in Go type conversion");
      const typeName: AST.Identifier = {
        kind: "Identifier",
        name: goType.kind === "SimpleType" ? ((goType as any).id?.name || "unknown") :
              goType.kind === "GenericType" ? ("[]" + ((goType as any).args?.[0]?.id?.name || "")) : "GoType",
        span: this.createSpan(start, this.current - 1)
      };
      return {
        kind: "Call",
        callee: typeName,
        args,
        span: this.createSpan(start, this.current - 1)
      } as AST.Call;
    }

    // Fallback: just return the type name as an identifier
    const typeName: AST.Identifier = {
      kind: "Identifier",
      name: goType.kind === "SimpleType" ? ((goType as any).id?.name || "GoType") : "GoType",
      span: this.createSpan(start, this.current - 1)
    };
    return typeName;
  }

  public parseDestructuringPattern(): AST.ArrayPattern | AST.ObjectPattern {
    const start = this.current;
    const token = this.peek();
    
    if (token.value === "[") {
      // Array destructuring pattern
      this.advance(); // consume [
      const elements: (AST.Identifier | AST.ArrayPattern | AST.ObjectPattern | null)[] = [];
      
      while (!this.check("]") && !this.isAtEnd()) {
        // Skip virtual semicolons
        while (this.peek().virtualSemi) this.advance();
        
        // Check for hole in array pattern (e.g., [a, , c])
        if (this.check(",")) {
          elements.push(null);
          this.advance();
          continue;
        }
        
        // Parse nested pattern or identifier
        if (this.check("[") || this.check("{")) {
          elements.push(this.parseDestructuringPattern());
        } else if (this.peek().type === TokenType.Identifier) {
          const name = this.parseIdentifier();
          elements.push(name);
        } else {
          break;
        }
        
        // Skip virtual semicolons before comma
        while (this.peek().virtualSemi) this.advance();
        
        if (!this.match(",")) {
          break;
        }
      }
      
      this.consume("]", "Expected ']' after array pattern");
      
      return {
        kind: "ArrayPattern",
        elements,
        span: this.createSpan(start, this.current - 1)
      };
    } else {
      // Object destructuring pattern
      this.advance(); // consume {
      const properties: AST.ObjectPatternProperty[] = [];
      
      while (!this.check("}") && !this.isAtEnd()) {
        // Skip virtual semicolons
        while (this.peek().virtualSemi) this.advance();
        
        const propStart = this.current;
        const key = this.parseIdentifier();
        
        let value: AST.Identifier | AST.ArrayPattern | AST.ObjectPattern = key;
        let shorthand = true;
        
        if (this.match(":")) {
          shorthand = false;
          // Parse nested pattern or identifier
          if (this.check("[") || this.check("{")) {
            value = this.parseDestructuringPattern();
          } else {
            value = this.parseIdentifier();
          }
        }
        
        properties.push({
          key,
          value,
          shorthand,
          span: this.createSpan(propStart, this.current - 1)
        });
        
        // Skip virtual semicolons before comma
        while (this.peek().virtualSemi) this.advance();
        
        if (!this.match(",")) {
          break;
        }
      }
      
      this.consume("}", "Expected '}' after object pattern");
      
      return {
        kind: "ObjectPattern",
        properties,
        span: this.createSpan(start, this.current - 1)
      };
    }
  }
  
  public parseExpressionBody(): AST.Block {
    const expr = this.parseExpression();
    return {
      kind: "Block",
      statements: [{
        kind: "Return",
        values: [expr],
        span: expr.span
      }],
      span: expr.span
    };
  }
  
  // Control flow parsing
  
  
  
  public parseExprStmt(): AST.ExprStmt | AST.If {
    const expr = this.parseExpression();
    
    // Check for reassignment operator :=:
    if (this.match(":=:")) {
      if (expr.kind !== "Identifier") {
        throw this.error(this.previous()!, "Reassignment requires an identifier");
      }
      const value = this.parseExpression();
      this.consumeSemicolon();
      return {
        kind: "ExprStmt",
        expr: {
          kind: "Assign",
          op: ":=:",
          left: expr,
          right: value,
          span: this.createSpanFrom(expr)
        },
        span: this.createSpanFrom(expr)
      };
    }
    
    // Check for postfix if/unless (Ruby-style) — only on same line
    if ((this.check("if") || this.check("unless")) && !this.peek().newline) {
      const modifier = this.peek().value;
      this.advance();
      const condition = this.parseExpression();
      
      // Create an If statement that executes expr if condition is true (or false for unless)
      const ifStmt: AST.If = {
        kind: "If",
        arms: [{
          test: modifier === "unless" ? {
            kind: "Unary",
            op: "!",
            argument: condition,
            prefix: true,
            span: condition.span
          } : condition,
          body: {
            kind: "Block",
            statements: [{
              kind: "ExprStmt",
              expr,
              span: expr.span
            }],
            span: expr.span
          },
          span: this.createSpanFrom(expr)
        }],
        span: this.createSpanFrom(expr)
      };
      
      this.consumeSemicolon();
      
      return ifStmt;
    }
    
    this.consumeSemicolon();
    
    return {
      kind: "ExprStmt",
      expr,
      span: expr.span
    };
  }
  
  // Type parsing
  public parseType(): AST.TypeNode {
    return Types.parseType(this);
  }
  
  
  
  // Other declaration parsing
  private parseTypeDecl(): AST.TypeDecl {
    const start = this.current - 1;
    const name = this.parseIdentifier();
    
    // Parse generic parameters if present
    let genericParams: AST.Identifier[] | undefined;
    if (this.match("<")) {
      genericParams = [];
      do {
        genericParams.push(this.parseIdentifier());
      } while (this.match(","));
      this.consume(">", "Expected '>' after generic parameters");
    }
    
    this.consume("=", "Expected '=' in type declaration");
    const definition = this.parseType();
    this.consumeSemicolon();
    
    return {
      kind: "TypeDecl",
      name,
      genericParams,
      definition,
      span: this.createSpan(start, this.current - 1)
    };
  }

  private parsePackageDecl(): AST.PackageDecl {
    const start = this.current - 1;
    const nameToken = this.peek().type === TokenType.Identifier ?
      this.advance() :
      this.consume(TokenType.StringLiteral, "Expected package name");

    const name: AST.Identifier = {
      kind: "Identifier",
      name: nameToken.value,
      span: this.createSpanFrom(nameToken)
    };

    this.consumeSemicolon();

    return {
      kind: "PackageDecl",
      name,
      span: this.createSpan(start, this.current - 1)
    };
  }

  private parseExportDecl(): AST.ExportDecl {
    const start = this.current - 1;

    // Handle 'export default'
    if (this.match("default")) {
      let declaration: AST.Decl | undefined;

      // Check if it's a declaration (class, function, etc.)
      if (this.isDeclStart()) {
        declaration = this.parseDeclaration();
      } else {
        // It's an expression - wrap it in an ExprStmt for now
        const expr = this.parseExpression();
        this.consumeSemicolon();
        // We'll store the expression as-is - could extend AST later
      }

      return {
        kind: "ExportDecl",
        declaration,
        isDefault: true,
        span: this.createSpan(start, this.current - 1)
      };
    }

    // Handle 'export type'
    if (this.match("type")) {
      // Check if it's export type { ... } or export type Name = ...
      if (this.check("{")) {
        // export type { ... }
        const specifiers = this.parseExportSpecifiers();

        let source: string | undefined;
        if (this.match("from")) {
          if (this.peek().type === TokenType.StringLiteral) {
            source = this.advance().value.slice(1, -1);
          }
        }

        this.consumeSemicolon();

        return {
          kind: "ExportDecl",
          specifiers,
          source,
          span: this.createSpan(start, this.current - 1)
        };
      } else {
        // export type Name = ...
        // Parse as type declaration
        const declaration = this.parseTypeDecl();
        return {
          kind: "ExportDecl",
          declaration,
          span: this.createSpan(start, this.current - 1)
        };
      }
    }

    // Check for export declaration (export function foo() {})
    if (this.isDeclStart()) {
      const declaration = this.parseDeclaration();
      return {
        kind: "ExportDecl",
        declaration,
        span: this.createSpan(start, this.current - 1)
      };
    }

    // Check for export specifiers (export { foo, bar })
    if (this.check("{")) {
      const specifiers = this.parseExportSpecifiers();

      let source: string | undefined;
      if (this.match("from")) {
        if (this.peek().type === TokenType.StringLiteral) {
          source = this.advance().value.slice(1, -1);
        }
      }

      this.consumeSemicolon();

      return {
        kind: "ExportDecl",
        specifiers,
        source,
        span: this.createSpan(start, this.current - 1)
      };
    }

    // Handle simple export: export Parser or export * from
    if (this.check("*")) {
      this.advance();
      if (this.match("from")) {
        let source: string | undefined;
        if (this.peek().type === TokenType.StringLiteral) {
          source = this.advance().value.slice(1, -1);
        }
        this.consumeSemicolon();

        return {
          kind: "ExportDecl",
          source,
          span: this.createSpan(start, this.current - 1)
        };
      }
    }

    // Try to consume as identifier
    if (this.peek().type === TokenType.Identifier) {
      this.advance();
      this.consumeSemicolon();

      return {
        kind: "ExportDecl",
        span: this.createSpan(start, this.current - 1)
      };
    }

    throw this.error(this.peek(), "Invalid export declaration");
  }

  private parseExportSpecifiers(): AST.ExportSpecifier[] {
    this.consume("{", "Expected '{'");
    const specifiers: AST.ExportSpecifier[] = [];

    if (!this.check("}")) {
      do {
        const local = this.parseIdentifier();
        let exported: AST.Identifier | undefined;

        if (this.match("as")) {
          exported = this.parseIdentifier();
        }

        specifiers.push({
          local,
          exported,
          span: this.createSpanFrom(local)
        });
      } while (this.match(","));
    }

    this.consume("}", "Expected '}'");
    return specifiers;
  }

  // Literal parsing
  // Literals extracted to src/parselets/literals.ts (Chunk 6)
  public parseStringLiteral(): AST.StringLiteral {
    return Literals.parseStringLiteral(this);
  }

  private parseNewExpression(): AST.Call {
    const start = this.current - 1;
    const callee = this.parsePrimary();
    
    let args: AST.Expr[] = [];
    if (this.match("(")) {
      args = this.parseArguments();
      this.must(")", { recoverWithSynthetic: true });
    }
    
    return {
      kind: "Call",
      callee: {
        kind: "Member",
        object: {
          kind: "Identifier",
          name: "new",
          span: this.createSpan(start, start)
        },
        property: callee as AST.Identifier,
        span: this.createSpanFrom(callee)
      },
      args,
      span: this.createSpan(start, this.current - 1)
    };
  }
  
  // Helper methods
  
  public parseIdentifier(): AST.Identifier {
    const token = this.peek();
    
    // Allow keywords as identifiers in member access context
    if (token.type === TokenType.Keyword && this.shouldReinterpretAsIdentifier()) {
      this.advance();
      return {
        kind: "Identifier",
        name: token.value,
        originalSpelling: token.value,
        span: this.createSpanFrom(token)
      };
    }
    
    if (token.type === TokenType.Identifier || 
        token.type === TokenType.SigilIdentifier) {
      this.advance();
      
      // Handle sigil identifiers
      const name = token.type === TokenType.SigilIdentifier ?
        token.value.slice(1) : // Remove $ prefix
        token.value;
      
      return {
        kind: "Identifier",
        name,
        originalSpelling: token.value,
        span: this.createSpanFrom(token)
      };
    }
    
    // Check for backtick identifier
    if (token.type === TokenType.TemplateLiteral && 
        this.shouldReinterpretAsIdentifier()) {
      return this.parseBacktickIdentifier();
    }
    
    // Return missing identifier instead of throwing
    this.errors.push(new ParseError("Expected identifier", token));
    return this.createMissingIdentifier();
  }
  
  private shouldReinterpretAsIdentifier(): boolean {
    // Check if we're in an identifier position
    const prev = this.previous();
    
    if (!prev) return false;
    
    // Declaration contexts
    if (prev.value === "def" || prev.value === "fun" || prev.value === "fn" ||
        prev.value === "function" || prev.value === "class" || prev.value === "struct" ||
        prev.value === "interface" || prev.value === "trait" || prev.value === "type" ||
        prev.value === "enum" || prev.value === "let" || prev.value === "var" ||
        prev.value === "const" || prev.value === "auto" || prev.value === "final" ||
        prev.value === "immutable") {
      return true;
    }
    
    // Import/export contexts
    if (prev.value === "import" || prev.value === "as" || prev.value === "export") {
      return true;
    }
    
    // Member access
    if (prev.value === "." || prev.value === "?.") {
      return true;
    }
    
    // Object property keys
    if (prev.value === "{" || prev.value === ",") {
      // Could be in an object literal context
      return true;
    }
    
    return false;
  }
  
  private parseBacktickIdentifier(): AST.Identifier {
    const token = this.advance();
    
    // For template literals that contain interpolations (${...}),
    // treat the entire literal as a string literal instead of an identifier
    if (token.value.includes('${')) {
      // This is actually a template literal with interpolations, not a backtick identifier
      // Return it as-is to be handled as a string literal
      this.current--; // Put the token back
      return Literals.parseTemplateLiteral(this) as any; // Treat as expression
    }
    
    // Extract content from backticks
    const content = token.value.slice(1, -1);
    
    // Validate it matches identifier pattern
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(content)) {
      // If not a valid identifier, treat it as a string literal
      this.current--; // Put the token back
      return Literals.parseTemplateLiteral(this) as any;
    }
    
    return {
      kind: "Identifier",
      name: content,
      originalSpelling: token.value,
      span: this.createSpanFrom(token)
    };
  }
  
  private parseIdentifierList(): AST.Identifier[] {
    const ids: AST.Identifier[] = [this.parseIdentifier()];
    
    while (this.match(",")) {
      ids.push(this.parseIdentifier());
    }
    
    return ids;
  }
  
  public parseExpressionList(): AST.Expr[] {
    const exprs: AST.Expr[] = [this.parseAssignmentExpression()];
    
    while (this.match(",")) {
      exprs.push(this.parseAssignmentExpression());
    }
    
    return exprs;
  }
  
  private parseArguments(): AST.Expr[] {
    const args: AST.Expr[] = [];
    
    // Skip virtual semicolons before first argument
    while (this.peek().virtualSemi) {
      this.advance();
    }
    
    if (!this.check(")")) {
      do {
        // Check for spread operator
        if (this.match("...")) {
          const spreadStart = this.current - 1;
          const argument = this.parseAssignmentExpression();
          args.push({
            kind: "Spread",
            argument,
            optional: false,
            span: this.createSpan(spreadStart, this.current - 1)
          });
        } else {
          // Parse expression but stop at comma at this level
          args.push(this.parseAssignmentExpression());
        }
        
        // Skip virtual semicolons after argument
        while (this.peek().virtualSemi) {
          this.advance();
        }

        // Python implicit string concatenation: adjacent string literals without comma
        while (this.peek().type === TokenType.StringLiteral && !this.check(")")) {
          const right = this.parseAssignmentExpression();
          const left = args[args.length - 1];
          args[args.length - 1] = {
            kind: "Binary",
            op: "+",
            left,
            right,
            span: this.createSpan((left.span as any).start ?? this.current - 2, this.current - 1)
          } as any;
          while (this.peek().virtualSemi) {
            this.advance();
          }
        }

        if (!this.match(",")) {
          break;
        }
        
        // Skip virtual semicolons after comma
        while (this.peek().virtualSemi) {
          this.advance();
        }
        
        // Tolerate trailing comma
        if (this.check(")")) {
          break;
        }
      } while (true);
    }
    
    return args;
  }
  
  public parseAssignmentExpression(): AST.Expr {
    // Parse everything except comma operator
    return this.parseExpression(this.getPrecedence({value: ","} as Token) + 1);
  }
  
  private tryParseGenericArgs(): AST.TypeNode[] | null {
    if (!this.check("<")) return null;

    const checkpoint = this.current;
    const errorCheckpoint = this.errors.length;

    try {
      this.advance(); // <
      const args: AST.TypeNode[] = [];

      do {
        args.push(this.parseType());
      } while (this.match(","));

      // Handle >> and >>> as closing brackets
      if (this.check(">>")) {
        // Treat >> as a single > and leave the second > for the next parse
        const originalToken = this.tokens[this.current];
        // Replace >> with > at current position
        this.tokens[this.current] = { ...originalToken, value: ">" };
        // Insert another > after it
        const syntheticToken = { ...originalToken, value: ">" };
        this.tokens.splice(this.current + 1, 0, syntheticToken);
        // Now consume the first >
        this.advance();
      } else if (this.check(">>>")) {
        // Treat >>> as a single > and leave >> for the next parse
        const originalToken = this.tokens[this.current];
        // Replace >>> with > at current position
        this.tokens[this.current] = { ...originalToken, value: ">" };
        // Insert >> after it
        const syntheticToken = { ...originalToken, value: ">>" };
        this.tokens.splice(this.current + 1, 0, syntheticToken);
        // Now consume the first >
        this.advance();
      } else {
        this.consume(">", "Expected '>' after generic arguments");
      }

      // Check if followed by valid continuation
      const next = this.peek();
      if (next.value === "(" || next.value === "[" || next.value === "{" ||
          next.value === ">" || next.value === ">>" || next.value === ">>>" ||
          next.value === ":" || next.value === "extends" ||
          next.value === "implements" || next.value === "where") {
        return args;
      }

      // Not a valid generic argument list — restore errors from failed attempt
      this.errors.length = errorCheckpoint;
      this.current = checkpoint;
      return null;
    } catch {
      // Failed to parse as generic args — restore errors from failed attempt
      this.errors.length = errorCheckpoint;
      this.current = checkpoint;
      return null;
    }
  }
  
  // Operator precedence
  private getPrecedence(token: Token): number {
    switch (token.value) {
      // Highest precedence (handled in parsePostfix)
      // case "(": case "[": case ".": case "?.": return 18;
      
      // Unary operators (handled in parsePrimary)
      // case "new": case "++": case "--": return 17;
      // case "!": case "~": case "+": case "-": case "typeof": case "void": case "delete": case "await": return 16;
      
      case "**": return 15;
      case "*": case "/": case "%": return 14;
      case "+": case "-": return 13;
      case "<<": case ">>": case ">>>": return 12;
      case "..": return 11.5; // Range operator
      case "<-": return 11.3; // Channel send operator
      case "<": case "<=": case ">": case ">=": case "in": case "instanceof": return 11;
      case "<=>": return 11; // Spaceship operator (comparison)
      case "==": case "!=": case "===": case "!==": return 10;
      case "=~": return 10;
      case "|>": return 9; // Pipeline operator
      case "&": return 9;
      case "^": return 8;
      case "|": return 7;
      case "&&": return 6;
      case "||": return 5;
      case "??": return 4;
      case "?": return 3; // Ternary
      case "=": case "+=": case "-=": case "*=": case "/=": case "%=":
      case "**=": case "<<=": case ">>=": case ">>>=":
      case "&=": case "^=": case "|=": case "??=":
      case ":=": case ":=:": return 2;
      case ",": return 1;
      
      default: return 0;
    }
  }
  
  /**
   * Check if `func` or `function` looks like a function call rather than a function expression.
   * func() with no body following the parens = function call.
   * func() { ... } or func name() { ... } = function expression.
   */
  private looksLikeFuncCall(): boolean {
    const kw = this.peek();
    if (kw.value !== "func" && kw.value !== "function") return false;
    const next = this.peekAt(1);
    if (!next || next.value !== "(") return false;
    // func( — scan past matched parens to see if a body follows
    let depth = 0;
    let pos = this.current + 1; // start at (
    while (pos < this.tokens.length) {
      const t = this.tokens[pos];
      if (t.value === "(") depth++;
      else if (t.value === ")") {
        depth--;
        if (depth === 0) {
          // Check what follows the closing paren
          const after = this.tokens[pos + 1];
          if (!after) return true; // EOF after func() = call
          // If body follows, it's a function expression
          if (after.value === "{" || after.value === ":" || after.value === "->") return false;
          // Otherwise it's a call
          return true;
        }
      }
      pos++;
    }
    return false;
  }

  private isRightAssociative(token: Token): boolean {
    return token.value === "**" || this.isAssignmentOp(token);
  }
  
  private isBinaryOp(token: Token): boolean {
    return this.getPrecedence(token) > 0 && !this.isAssignmentOp(token);
  }
  
  private isAssignmentOp(token: Token): boolean {
    const op = token.value;
    return op === "=" || op === "+=" || op === "-=" || op === "*=" ||
           op === "/=" || op === "%=" || op === "**=" || op === "<<=" ||
           op === ">>=" || op === ">>>=" || op === "&=" || op === "^=" ||
           op === "|=" || op === "??=" || op === "||=" || op === "&&=" ||
           op === ":=" || op === ":=:";
  }
  
  private isUnaryOp(token: Token): boolean {
    const op = token.value;
    return op === "!" || op === "~" || op === "+" || op === "-" ||
           op === "typeof" || op === "void" || op === "delete" ||
           op === "await" || op === "++" || op === "--" || op === "&" || op === "*" || op === "**";
  }

  // Override synchronize to include isDeclStart() check
  public override synchronize(): void {
    this.advance();

    while (!this.isAtEnd()) {
      if (this.previous()?.type === TokenType.Operator &&
          this.previous()?.value === ";") {
        return;
      }

      const token = this.peek();
      if (token.value === "fi" || token.value === "esac" || token.value === "done" ||
          token.value === "end" || token.value === "}" || token.value === "elif" ||
          token.value === "else" || token.value === "elseif" || token.value === "rescue" ||
          token.value === "ensure" || token.value === "except" || token.value === "finally") {
        return;
      }

      if (this.isDeclStart()) {
        return;
      }

      this.advance();
    }
  }

  // JSX methods extracted to src/parselets/jsx.ts (Chunk 2)
}
