import './lexer';
import AST from './ast';
export class ParseError extends Error {
constructor(message: string, token: Token, quickFix: string)   {
super(message)    ;
this.name = 'ParseError'    ;
  }}
export class Parser {
tokens: Token<>  ;
current  ;
errors: ParseError<>  ;
braceDepth  ;
indentStack: number<>  ;
keywordStack: Array<"do" | "case" | "begin" | "if" | "for" | "while" | "function">  ;
syntheticTokenCounter  ;
insideSwitch  ;
nextStmtGenericMode: "on" | "off" | "auto"  ;
constructor(tokens: Token<>)   {
this.tokens = tokens.filter(t => t.type !== TokenType.Comment && t.type !== TokenType.Whitespace)    ;
  }getErrors(): ParseError<>   {
return this.errors    ;
  }parse(): AST.Program   {
const body: Array<AST.Decl | AST.Stmt> = []    ;
let iterations = 0    ;
const maxIterations = Math.max(1000, this.tokens.length * 2)    ;
if (typeofprocess !== 'undefined' && process.env.DEBUG_HANG)     {
console.log(`[PARSE] Starting with ${/* TODO: undefined */} tokens`)      ;
    }while (!this.isAtEnd())     {
iterations++      ;
if (iterations > maxIterations)       {
console.error(`Parser exceeded maximum iterations (${/* TODO: undefined */}) - possible infinite loop`)        ;
console.error(`Current position: ${/* TODO: undefined */}/${/* TODO: undefined */}`)        ;
console.error(`Current token: ${/* TODO: undefined */} (${/* TODO: undefined */})`)        ;
console.error(`Parsed ${/* TODO: undefined */} statements so far`)        ;
return { kind: 'Program', body, span: this.createSpan(0, Math.min(this.current, this.tokens.length - 1)) }        ;
      }const beforePos = this.current      ;
try       {
const item = this.parseTopLevel()        ;
if (item)         {
body.push(item)          ;
        } else         {
if (!this.isAtEnd())           {
if (this.current === beforePos)             {
console.error(`Warning: parseTopLevel returned null at position ${/* TODO: undefined */}, token: ${/* TODO: undefined */}`)              ;
this.advance()              ;
            }          }        }      } catch (error)       {
if (error instanceof ParseError)         {
this.errors.push(error)          ;
if (typeofprocess !== 'undefined' && process.env.DEBUG_PARSER)           {
console.log('Parse error:', error.message, 'at token:', error.token)            ;
          }this.synchronize()          ;
        } else         {
throw error          ;
        }      }if (this.current === beforePos && !this.isAtEnd())       {
console.error(`Parser stuck at position ${/* TODO: undefined */}, token: ${/* TODO: undefined */}`)        ;
console.error(`Forcing advance from ${/* TODO: undefined */}`)        ;
this.advance()        ;
      }    }return { kind: 'Program', body, span: this.createSpan(0, this.tokens.length - 1) }    ;
  }createSyntheticToken(type: TokenType, value: string): Token   {
const pos = this.current > 0 ? this.tokens[this.current - 1].end : 0    ;
return { type, value, start: pos, end: pos, line: this.current > 0 ? this.tokens[this.current - 1].line : 1, column: this.current > 0 ? this.tokens[this.current - 1].column + 1 : 1, synthetic: true } as Token    ;
  }createMissingExpr(): AST.Expr   {
const span = this.current > 0 ? this.createSpan(this.current - 1, this.current - 1) : this.createSpan(0, 0)    ;
return { kind: 'Identifier', name: '__missing__', span }    ;
  }createMissingIdentifier(): AST.Identifier   {
const span = this.current > 0 ? this.createSpan(this.current - 1, this.current - 1) : this.createSpan(0, 0)    ;
return { kind: 'Identifier', name: '__missing__', span }    ;
  }must(expected: string, options: object): boolean   {
while (this.peek().virtualSemi)     {
this.advance()      ;
    }if (this.check(expected))     {
this.advance()      ;
return true      ;
    }if (options?.recoverWithSynthetic)     {
this.errors.push(new.undefined())      ;
return true      ;
    }throw this.error(this.peek(), `Expected '${/* TODO: undefined */}'`)    ;
  }parseTopLevel(): AST.Decl | AST.Stmt | null   {
this.consumeDirectives()    ;
let vsCount = 0    ;
while (this.peek().virtualSemi)     {
this.advance()      ;
vsCount++      ;
if (vsCount > 100)       {
console.error(`Error: Skipped ${/* TODO: undefined */} virtual semicolons without progress`)        ;
return null        ;
      }    }if (this.isAtEnd())     {
return null      ;
    }if (this.check('}'))     {
if (this.braceDepth > 0)       {
return null        ;
      } else       {
this.advance()        ;
return null        ;
      }    }if (this.check('@'))     {
const decorators: AST.Expr<> = []      ;
while (this.check('@'))       {
this.advance()        ;
const name = this.parseIdentifier()        ;
const decorator = this.parsePostfix(name)        ;
decorators.push(decorator)        ;
while (this.peek().virtualSemi)         {
this.advance()          ;
        }      }if (this.match('async', 'unsafe'))       {
const isAsync = this.previous()?.value === 'async'        ;
const isUnsafe = this.previous()?.value === 'unsafe'        ;
if (this.match('def', 'fun', 'fn', 'func', 'function'))         {
const isGenerator = this.previous()?.value === 'function' && this.match('*')          ;
const func = this.parseFuncDecl(isAsync, isUnsafe, isGenerator)          ;
return func          ;
        }      } else       {
if (this.match('def', 'fun', 'fn', 'func', 'function'))         {
const isGenerator = this.previous()?.value === 'function' && this.match('*')          ;
const func = this.parseFuncDecl(false, false, isGenerator)          ;
return func          ;
        } else         {
if (this.match('class'))           {
const cls = this.parseClassDecl()            ;
return cls            ;
          }        }      }throw this.error(this.peek(), 'Expected function or class declaration after decorators')      ;
    }if (this.peek().type === TokenType.Identifier)     {
const checkpoint = this.current      ;
this.advance()      ;
if (this.check(':='))       {
this.current = checkpoint        ;
return this.parseShortDecl()        ;
      }this.current = checkpoint      ;
    } else     {
if (this.peek().value === '{' || this.peek().value === '[' && this.peekAhead(':='))       {
return this.parseDestructuringShortDecl()        ;
      }    }if (this.isDeclStart())     {
return this.parseDeclaration()      ;
    }return this.parseStatement()    ;
  }isStatementKeyword(keyword: string): boolean   {
return keyword === 'if' || keyword === 'while' || keyword === 'for' || keyword === 'do' || keyword === 'switch' || keyword === 'try' || keyword === 'throw' || keyword === 'return' || keyword === 'break' || keyword === 'continue' || keyword === 'case' || keyword === 'default' || keyword === 'new' || keyword === 'yield' || keyword === 'await' || keyword === 'match' || keyword === 'using' || keyword === 'defer' || keyword === 'go' || keyword === 'echo'    ;
  }isDeclStart(): boolean   {
const type = this.peek().type    ;
const value = this.peek().value    ;
if (value === '@')     {
return true      ;
    }if (value === 'using')     {
const next = this.peekNext()      ;
return next?.type === TokenType.StringLiteral || next?.type === TokenType.Identifier && this.peekAt(2)?.value !== '='      ;
    }if (value === 'async' || value === 'unsafe')     {
const next = this.peekNext()      ;
return next?.value === 'fn' || next?.value === 'fun' || next?.value === 'function' || next?.value === 'def' || next?.value === 'func' || next?.value === 'async' || next?.value === 'unsafe'      ;
    }if (value === 'type')     {
const next = this.peekNext()      ;
return next?.type === TokenType.Identifier      ;
    }return type === TokenType.Keyword && value === 'import' || value === 'require' || value === 'let' || value === 'var' || value === 'auto' || value === 'fn' || value === 'fun' || value === 'function' || value === 'def' || value === 'func' || value === 'const' || value === 'final' || value === 'immutable' || value === 'class' || value === 'struct' || value === 'interface' || value === 'trait' || value === 'enum' || value === 'package' || value === 'export' || type === TokenType.Operator && value === '#' && this.peekNext()?.type === TokenType.Identifier && this.peekNext()?.value === 'include'    ;
  }parseDeclaration(): AST.Decl   {
const token = this.peek()    ;
if (this.match('import', 'require'))     {
return this.parseImport()      ;
    }if (this.peek().value === 'using')     {
const next = this.peekNext()      ;
if (next?.type === TokenType.StringLiteral || next?.type === TokenType.Identifier && this.peekAt(2)?.value !== '=')       {
this.advance()        ;
return this.parseImport()        ;
      }throw this.error(this.peek(), 'Expected declaration')      ;
    }if (this.check('#') && this.peekNext()?.value === 'include')     {
this.advance()      ;
this.advance()      ;
return this.parseImport()      ;
    }if (this.match('let', 'var', 'auto'))     {
return this.parseVarDecl()      ;
    }if (this.match('const', 'final', 'immutable'))     {
return this.parseConstDecl()      ;
    }if (this.peek().value === 'async' || this.peek().value === 'unsafe')     {
let isAsync = false      ;
let isUnsafe = false      ;
if (this.match('async'))       {
isAsync = true        ;
if (this.match('unsafe'))         {
isUnsafe = true          ;
        }      } else       {
if (this.match('unsafe'))         {
isUnsafe = true          ;
if (this.match('async'))           {
isAsync = true            ;
          }        }      }if (this.match('def', 'fun', 'fn', 'func', 'function'))       {
const funcKeyword = this.previous()?.value        ;
const isGenerator = funcKeyword === 'function' && this.match('*')        ;
return this.parseFuncDecl(isAsync, isUnsafe, isGenerator)        ;
      }throw this.error(this.peek(), 'Expected function declaration after async/unsafe')      ;
    }if (this.match('def', 'fun', 'fn', 'func', 'function'))     {
const isGenerator = this.previous()?.value === 'function' && this.match('*')      ;
return this.parseFuncDecl(false, false, isGenerator)      ;
    }if (this.isType())     {
const checkpoint = this.current      ;
try       {
const type = this.parseType()        ;
if (this.peek().type === TokenType.Identifier)         {
const name = this.advance()          ;
if (this.check('('))           {
this.current = checkpoint            ;
return this.parseFuncDeclWithReturnTypeBefore()            ;
          }        }this.current = checkpoint        ;
      } catch       {
this.current = checkpoint        ;
      }    }if (this.match('type'))     {
return this.parseTypeDecl()      ;
    }if (this.match('class'))     {
return this.parseClassDecl()      ;
    }if (this.match('interface', 'trait'))     {
return this.parseInterfaceDecl()      ;
    }if (this.match('enum'))     {
return this.parseEnumDecl()      ;
    }if (this.match('package'))     {
return this.parsePackageDecl()      ;
    }if (this.match('export'))     {
return this.parseExportDecl()      ;
    }if (this.peek().type === TokenType.Identifier)     {
const checkpoint = this.current      ;
const id = this.advance()      ;
if (this.match(':='))       {
this.current = checkpoint        ;
return this.parseShortDecl()        ;
      }this.current = checkpoint      ;
    }throw this.error(this.peek(), 'Expected declaration')    ;
  }parseStatement(): AST.Stmt   {
if (this.peek().value === 'async' && this.peekNext()?.value === 'for')     {
this.advance()      ;
this.advance()      ;
return this.parseLoop()      ;
    }if (this.match('if'))     {
return this.parseIf()      ;
    }if (this.match('switch', 'match'))     {
return this.parseSwitch()      ;
    }if (this.peek().value === 'case' && !this.insideSwitch)     {
this.advance()      ;
return this.parseCaseStatement()      ;
    }if (this.match('select'))     {
return this.parseSelectStatement()      ;
    }if (this.match('do'))     {
return this.parseDoStatement()      ;
    }if (this.match('for', 'while', 'until', 'loop'))     {
return this.parseLoop()      ;
    }if (this.match('foreach'))     {
return this.parseForeach()      ;
    }if (this.match('try'))     {
return this.parseTry()      ;
    }if (this.match('with'))     {
return this.parseUsing()      ;
    }if (this.peek().value === 'using')     {
const next = this.peekNext()      ;
const nextNext = this.peekAt(2)      ;
if (next?.type === TokenType.Identifier && nextNext?.value === '=')       {
this.advance()        ;
return this.parseUsing()        ;
      }    }if (this.match('defer'))     {
return this.parseDefer()      ;
    }if (this.match('break'))     {
return this.parseBreak()      ;
    }if (this.match('continue'))     {
return this.parseContinue()      ;
    }if (this.match('return'))     {
return this.parseReturn()      ;
    }if (this.match('assert'))     {
return this.parseAssert()      ;
    }if (this.match('echo', 'print'))     {
return this.parseEcho()      ;
    }if (this.match('throw', 'raise'))     {
return this.parseThrow()      ;
    }if (this.match('go'))     {
return this.parseGo()      ;
    }if (this.match('defer'))     {
return this.parseDefer()      ;
    }if (this.match('pass'))     {
return this.parsePass()      ;
    }if (this.match('begin'))     {
return this.parseBeginBlock()      ;
    }if (this.check('{'))     {
const checkpoint = this.current      ;
try       {
this.advance()        ;
let isDestructuring = false        ;
if (this.peek().type === TokenType.Identifier)         {
this.advance()          ;
if (this.check(',') || this.check('}'))           {
isDestructuring = true            ;
          }        }this.current = checkpoint        ;
if (isDestructuring)         {
return this.parseExprStmt()          ;
        } else         {
return this.parseBlock()          ;
        }      } catch       {
this.current = checkpoint        ;
return this.parseBlock()        ;
      }    }return this.parseExprStmt()    ;
  }parseBlockOrStatement(): AST.Block   {
if (this.check('{'))     {
return this.parseBlock()      ;
    } else     {
const stmt = this.parseStatement()      ;
return { kind: 'Block', statements: stmt ? [stmt] : [], span: this.createSpanFrom(stmt || this.previous()) }      ;
    }  }parseBlock(): AST.Block   {
const start = this.current    ;
const openToken = this.peek()    ;
if (this.match('{'))     {
this.braceDepth++      ;
const statements: Array<AST.Decl | AST.Stmt> = []      ;
let loopCount = 0      ;
while (!this.check('}') && !this.isAtEnd())       {
loopCount++        ;
if (loopCount > 1000)         {
console.error(`parseBlock exceeded 1000 iterations at position ${/* TODO: undefined */}`)          ;
console.error(`Current token: ${/* TODO: undefined */} (${/* TODO: undefined */})`)          ;
break          ;
        }const beforePos = this.current        ;
try         {
const stmt = this.parseTopLevel()          ;
if (stmt)           {
statements.push(stmt)            ;
          }        } catch (error)         {
if (error instanceof ParseError)           {
this.errors.push(error)            ;
this.synchronize()            ;
          } else           {
throw error            ;
          }        }if (this.current === beforePos && !this.check('}'))         {
console.error(`parseBlock not advancing at position ${/* TODO: undefined */}, forcing advance`)          ;
this.advance()          ;
        }      }if (!this.match('}'))       {
throw this.error(this.peek(), 'Expected \'}\'')        ;
      }this.braceDepth--      ;
return { kind: 'Block', statements, span: this.createSpan(start, this.current - 1) }      ;
    }if (this.checkIndentBlock())     {
return this.parseIndentBlock()      ;
    }if (this.checkKeywordBlock())     {
return this.parseKeywordBlock()      ;
    }throw this.error(this.peek(), 'Expected block')    ;
  }checkIndentBlock(): boolean   {
if (this.current > 0)     {
const prev = this.tokens[this.current - 1]      ;
if (prev.type === TokenType.Operator && prev.value === ':')       {
const nextToken = this.peek()        ;
if (nextToken.indentCol !== null && this.indentStack.length === 0 || nextToken.indentCol > this.indentStack[this.indentStack.length - 1])         {
return true          ;
        }      }    }return false    ;
  }parseSelectStatement(): AST.Switch   {
const start = this.current - 1    ;
const cases: AST.SwitchCase<> = []    ;
let defaultCase: AST.Block | undefined    ;
this.consume('{', 'Expected \'{\' after select')    ;
while (!this.check('}') && !this.isAtEnd())     {
while (this.peek().virtualSemi)       {
this.advance()        ;
      }if (this.check('}') || this.isAtEnd())       {
break        ;
      }if (this.match('default'))       {
this.consume(':', 'Expected \':\' after default')        ;
defaultCase = this.parseCaseBody()        ;
continue        ;
      }if (this.match('case'))       {
const pattern = this.parseExpression()        ;
this.consume(':', 'Expected \':\' after case')        ;
const body = this.parseCaseBody()        ;
cases.push({ patterns: [pattern], body, fallthrough: false, span: this.createSpan(start, this.current - 1) })        ;
continue        ;
      }throw this.error(this.peek(), 'Expected \'case\' or \'default\' in select statement')      ;
    }this.consume('}', 'Expected \'}\' after select body')    ;
const discriminant: AST.Identifier = { kind: 'Identifier', name: '__select__', originalSpelling: '__select__', span: this.createSpan(start, start) }    ;
return { kind: 'Switch', discriminant, cases, defaultCase, span: this.createSpan(start, this.current - 1) }    ;
  }parseCaseStatement(): AST.Switch   {
const start = this.current - 1    ;
const discriminant = this.parsePrimary()    ;
this.consume('in', 'Expected \'in\' after case expression')    ;
return this.parseCaseEsac(start, discriminant)    ;
  }parseCaseEsac(start: number, discriminant: AST.Expr): AST.Switch   {
const cases: AST.SwitchCase<> = []    ;
let defaultCase: AST.Block | undefined    ;
while (!this.check('esac') && !this.isAtEnd())     {
while (this.peek().virtualSemi)       {
this.advance()        ;
      }if (this.check('esac'))       {
break        ;
      }const patterns: AST.Expr<> = []      ;
if (this.match('*'))       {
this.consume(')', 'Expected \')\' after case pattern')        ;
const statements: Array<AST.Decl | AST.Stmt> = []        ;
while (!this.check(';;') && !this.check('esac') && !this.isAtEnd() && !this.peek().type === TokenType.NumericLiteral || this.peek().type === TokenType.StringLiteral || this.peek().value === '*')         {
const stmt = this.parseTopLevel()          ;
if (stmt)           {
statements.push(stmt)            ;
          }        }defaultCase = { kind: 'Block', statements, span: this.createSpan(this.current, this.current) }        ;
this.match(';;')        ;
      } else       {
patterns.push(this.parseExpression())        ;
this.consume(')', 'Expected \')\' after case pattern')        ;
const statements: Array<AST.Decl | AST.Stmt> = []        ;
while (!this.check(';;') && !this.check('esac') && !this.isAtEnd() && !this.peek().type === TokenType.NumericLiteral || this.peek().type === TokenType.StringLiteral || this.peek().value === '*')         {
const stmt = this.parseTopLevel()          ;
if (stmt)           {
statements.push(stmt)            ;
          }        }const body: AST.Block = { kind: 'Block', statements, span: this.createSpan(this.current, this.current) }        ;
const fallthrough = !this.match(';;')        ;
cases.push({ patterns, body, fallthrough, span: this.createSpan(this.current, this.current) })        ;
      }    }this.consume('esac', 'Expected \'esac\' to close case statement')    ;
return { kind: 'Switch', discriminant, cases, defaultCase, span: this.createSpan(start, this.current - 1) }    ;
  }parseBashTestExpression(): AST.Expr   {
const start = this.current    ;
this.consume('[', 'Expected \'[\' for bash test')    ;
const args: AST.Expr<> = []    ;
while (!this.check(']') && !this.isAtEnd())     {
if (this.peek().virtualSemi)       {
this.advance()        ;
continue        ;
      }if (this.peek().type === TokenType.Operator)       {
const op = this.advance()        ;
if (op.value === '-' && this.peek().type === TokenType.Identifier)         {
const flag = this.advance()          ;
args.push({ kind: 'Identifier', name: op.value + flag.value, span: this.createSpan(this.current - 2, this.current - 1) })          ;
        } else         {
args.push({ kind: 'Identifier', name: op.value, span: this.createSpanFrom(op) })          ;
        }      } else       {
if (this.peek().type === TokenType.StringLiteral || this.peek().type === TokenType.NumericLiteral || this.peek().type === TokenType.Identifier || this.peek().type === TokenType.SigilIdentifier)         {
args.push(this.parsePrimary())          ;
        } else         {
this.advance()          ;
        }      }    }this.consume(']', 'Expected \']\' after bash test')    ;
return { kind: 'Call', callee: { kind: 'Identifier', name: 'test', span: this.createSpan(start, start) }, args, span: this.createSpan(start, this.current - 1) }    ;
  }parseIfThenBlock(): AST.Block   {
const start = this.current    ;
const statements: Array<AST.Decl | AST.Stmt> = []    ;
while (!this.check('fi') && !this.check('elif') && !this.check('elseif') && !this.check('else') && !this.isAtEnd())     {
const beforePos = this.current      ;
try       {
const stmt = this.parseTopLevel()        ;
if (stmt)         {
statements.push(stmt)          ;
        }      } catch (error)       {
if (error instanceof ParseError)         {
this.errors.push(error)          ;
this.synchronize()          ;
        } else         {
throw error          ;
        }      }if (this.current === beforePos)       {
this.advance()        ;
      }    }return { kind: 'Block', statements, span: this.createSpan(start, this.current - 1) }    ;
  }parseIndentBlock(): AST.Block   {
const start = this.current    ;
while (this.peek().virtualSemi)     {
this.advance()      ;
    }const baseIndent = this.indentStack.length > 0 ? this.indentStack[this.indentStack.length - 1] : 0    ;
const blockIndent = this.peek().indentCol ?? 0    ;
if (blockIndent <= baseIndent && !this.isAtEnd())     {
return { kind: 'Block', statements: [], span: this.createSpan(start, this.current) }      ;
    }this.indentStack.push(blockIndent)    ;
const statements: Array<AST.Decl | AST.Stmt> = []    ;
while (!this.isAtEnd())     {
const nextIndent = this.peek().indentCol ?? 0      ;
if (nextIndent < blockIndent)       {
break        ;
      }try       {
const stmt = this.parseTopLevel()        ;
if (stmt)         {
statements.push(stmt)          ;
        }      } catch (error)       {
if (error instanceof ParseError)         {
this.errors.push(error)          ;
this.synchronize()          ;
        } else         {
throw error          ;
        }      }    }this.indentStack.pop()    ;
return { kind: 'Block', statements, span: this.createSpan(start, this.current - 1) }    ;
  }checkKeywordBlock(): boolean   {
const value = this.previous()?.value    ;
return value === 'do' || value === 'case' || value === 'begin' || value === 'if' && this.isBashOrRubyStyle() || value === 'for' && this.isRubyStyle() || value === 'while' && this.isRubyStyle() || value === 'function' && this.isBashStyle()    ;
  }parseBeginBlock(): AST.Try | AST.Block   {
const start = this.current - 1    ;
const statements: Array<AST.Decl | AST.Stmt> = []    ;
while (!this.check('rescue') && !this.check('ensure') && !this.check('end') && !this.isAtEnd())     {
if (this.peek().virtualSemi)       {
this.advance()        ;
continue        ;
      }const beforePos = this.current      ;
try       {
const stmt = this.parseTopLevel()        ;
if (stmt)         {
statements.push(stmt)          ;
        }      } catch (error)       {
if (error instanceof ParseError)         {
this.errors.push(error)          ;
this.synchronize()          ;
        } else         {
throw error          ;
        }      }if (this.current === beforePos)       {
this.advance()        ;
      }    }if (this.check('end'))     {
this.advance()      ;
return { kind: 'Block', statements, span: this.createSpan(start, this.current - 1) }      ;
    }const body: AST.Block = { kind: 'Block', statements, span: this.createSpan(start, this.current - 1) }    ;
const catches: AST.CatchClause<> = []    ;
while (this.match('rescue'))     {
let param: AST.Identifier | undefined      ;
let type: AST.TypeNode | undefined      ;
if (this.peek().type === TokenType.Identifier && !this.check('=>'))       {
type = this.parseType()        ;
      }if (this.match('=>'))       {
param = this.parseIdentifier()        ;
      }const rescueStatements: Array<AST.Decl | AST.Stmt> = []      ;
while (!this.check('rescue') && !this.check('ensure') && !this.check('end') && !this.isAtEnd())       {
if (this.peek().virtualSemi)         {
this.advance()          ;
continue          ;
        }const beforePos = this.current        ;
try         {
const stmt = this.parseTopLevel()          ;
if (stmt)           {
rescueStatements.push(stmt)            ;
          }        } catch (error)         {
if (error instanceof ParseError)           {
this.errors.push(error)            ;
this.synchronize()            ;
          } else           {
throw error            ;
          }        }if (this.current === beforePos && !this.check('rescue') && !this.check('ensure') && !this.check('end'))         {
console.error(`parseBeginBlock rescue body stuck at position ${/* TODO: undefined */}, forcing advance`)          ;
this.advance()          ;
        }      }catches.push({ param, type, body: { kind: 'Block', statements: rescueStatements, span: this.createSpan(this.current - 1, this.current) }, span: this.createSpan(this.current - 1, this.current) })      ;
    }let finallyBlock: AST.Block | undefined    ;
if (this.match('ensure'))     {
const ensureStatements: Array<AST.Decl | AST.Stmt> = []      ;
while (!this.check('end') && !this.isAtEnd())       {
if (this.peek().virtualSemi)         {
this.advance()          ;
continue          ;
        }try         {
const stmt = this.parseTopLevel()          ;
if (stmt)           {
ensureStatements.push(stmt)            ;
          }        } catch (error)         {
if (error instanceof ParseError)           {
this.errors.push(error)            ;
this.synchronize()            ;
          } else           {
throw error            ;
          }        }      }finallyBlock = { kind: 'Block', statements: ensureStatements, span: this.createSpan(this.current - 1, this.current) }      ;
    }this.consume('end', 'Expected \'end\' to close begin block')    ;
return { kind: 'Try', body, catches, finallyBody: finallyBlock, span: this.createSpan(start, this.current - 1) }    ;
  }parseKeywordBlock(keyword: string): AST.Block   {
const start = this.current    ;
const actualKeyword = keyword || this.previous()?.value || 'do'    ;
this.keywordStack.push(actualKeyword as any)    ;
const statements: Array<AST.Decl | AST.Stmt> = []    ;
const endKeyword = this.getEndKeyword(actualKeyword)    ;
while (!this.check(endKeyword) && !this.isAtEnd())     {
if (this.peek().virtualSemi)       {
this.advance()        ;
continue        ;
      }try       {
const stmt = this.parseTopLevel()        ;
if (stmt)         {
statements.push(stmt)          ;
        }      } catch (error)       {
if (error instanceof ParseError)         {
this.errors.push(error)          ;
this.synchronize()          ;
        } else         {
throw error          ;
        }      }    }if (!this.match(endKeyword))     {
throw this.error(this.peek(), `Expected '${/* TODO: undefined */}'`)      ;
    }this.keywordStack.pop()    ;
return { kind: 'Block', statements, span: this.createSpan(start, this.current - 1) }    ;
  }getEndKeyword(keyword: string): string   {
switch (keyword    ) {
case 'do'      :
        {
return 'done'          ;
        }        break;
case 'case'      :
        {
return 'esac'          ;
        }        break;
case 'begin'      :
        {
return 'end'          ;
        }        break;
case 'if'      :
        {
return 'fi'          ;
        }        break;
case 'for'      :
        {
        }        break;
case 'while'      :
        {
        }        break;
case 'function'      :
        {
return this.isBashStyle() ? 'done' : 'end'          ;
        }        break;
      default:
        {
return 'end'          ;
        }    }
  }isBashStyle(): boolean   {
return false    ;
  }isRubyStyle(): boolean   {
return false    ;
  }isBashOrRubyStyle(): boolean   {
return this.isBashStyle() || this.isRubyStyle()    ;
  }parseExpression(minPrecedence = 0): AST.Expr   {
let left = this.parsePrimary()    ;
if (left.kind === 'Identifier' && this.check('=>'))     {
this.advance()      ;
while (this.peek().virtualSemi)       {
this.advance()        ;
      }const body = this.check('{') ? this.parseBlock() : this.parseExpression()      ;
return { kind: 'Lambda', params: [{ name: left as AST.Identifier, type: null, defaultValue: null, span: left.span }], returnType: null, body, span: this.createSpanFrom(left) }      ;
    }while (true)     {
const op = this.peek()      ;
if (op.value === 'as')       {
this.advance()        ;
const type = this.parseType()        ;
left = { kind: 'TypeAssertion', expr: left, type, span: this.createSpanFrom(left) }        ;
continue        ;
      }if (!this.isBinaryOp(op) && !this.isAssignmentOp(op))       {
break        ;
      }const precedence = this.getPrecedence(op)      ;
if (precedence < minPrecedence)       {
break        ;
      }this.advance()      ;
while (this.peek().virtualSemi)       {
this.advance()        ;
      }if (op.value === '?')       {
const consequent = this.parseExpression()        ;
this.consume(':', 'Expected \':\' in ternary expression')        ;
const alternate = this.parseExpression(precedence)        ;
left = { kind: 'Ternary', test: left, consequent, alternate, span: this.createSpanFrom(left) }        ;
continue        ;
      }const isRightAssoc = this.isRightAssociative(op)      ;
const nextMinPrec = isRightAssoc ? precedence : precedence + 1      ;
let right: AST.Expr      ;
if (op.value === '|>' && this.check('match'))       {
this.advance()        ;
const switchStmt = this.parseSwitch()        ;
right = switchStmt as any        ;
      } else       {
right = this.parseExpression(nextMinPrec)        ;
      }if (this.isAssignmentOp(op))       {
left = { kind: 'Assign', op: op.value, left, right, span: this.createSpanFrom(left) }        ;
      } else       {
left = { kind: 'Binary', op: op.value, left, right, span: this.createSpanFrom(left) }        ;
      }    }return left    ;
  }parsePrimary(): AST.Expr   {
if (this.peek().value === 'async')     {
const next = this.peekNext()      ;
const isAsyncFunction = next && next.value === '(' || next.value === '{' || next.type === TokenType.Identifier && this.peekAt(2)?.value === '=>' || next.value === 'function'      ;
if (isAsyncFunction)       {
this.advance()        ;
const start = this.current - 1        ;
if (this.check('(') || this.peek().type === TokenType.Identifier || this.check('{'))         {
const lambda = this.parseAsyncLambda(start)          ;
return this.parsePostfix(lambda)          ;
        }throw this.error(this.peek(), 'Expected lambda or block after async')        ;
      }    }if (this.match('yield'))     {
return this.parseYieldExpression()      ;
    }if (this.check('<-'))     {
const op = this.advance()      ;
const argument = this.parsePrimary()      ;
return { kind: 'Unary', op: '<-', argument, prefix: true, span: this.createSpan(this.current - 1, this.current) }      ;
    }if (this.peek().value === '<')     {
const next = this.peekNext()      ;
if (next && next.type === TokenType.Identifier)       {
const checkpoint = this.current        ;
this.advance()        ;
const typeStart = this.current        ;
if (this.match('Identifier'))         {
const typeName = this.tokens[this.current - 1].value          ;
if (this.match('>'))           {
const expr = this.parsePrimary()            ;
const type: AST.SimpleType = { kind: 'SimpleType', id: { kind: 'Identifier', name: typeName, span: this.createSpan(typeStart, typeStart) }, span: this.createSpan(typeStart, this.current - 1) }            ;
return { kind: 'TypeAssertion', expr, type, span: this.createSpan(checkpoint, this.current - 1) }            ;
          }        }this.current = checkpoint        ;
      }    }if (this.isUnaryOp(this.peek()))     {
const op = this.advance()      ;
const argument = this.parsePrimary()      ;
return { kind: 'Unary', op: op.value, argument, prefix: true, span: this.createSpan(this.current - 1, this.current) }      ;
    }if (this.peek().type === TokenType.NumericLiteral)     {
return this.parseNumericLiteral()      ;
    }if (this.peek().type === TokenType.StringLiteral)     {
return this.parseStringLiteral()      ;
    }if (this.peek().type === TokenType.TemplateLiteral)     {
if (this.shouldReinterpretAsIdentifier())       {
return this.parseBacktickIdentifier()        ;
      }return this.parseTemplateLiteral()      ;
    }if (this.peek().type === TokenType.RegexLiteral)     {
return this.parsePostfix(this.parseRegexLiteral())      ;
    }if (this.match('true', 'false'))     {
const token = this.previous()      ;
return { kind: 'BooleanLiteral', value: token?.value === 'true', span: this.createSpanFrom(token!) }      ;
    }if (this.match('null', 'undefined', 'nil'))     {
return { kind: 'NullLiteral', span: this.createSpanFrom(this.previous()!) }      ;
    }if (this.match('this', 'super'))     {
const token = this.previous()!      ;
const id: AST.Identifier = { kind: 'Identifier', name: token.value, span: this.createSpanFrom(token) }      ;
return this.parsePostfix(id)      ;
    }if (this.peek().type === TokenType.Identifier || this.peek().type === TokenType.SigilIdentifier || this.peek().type === TokenType.Keyword && !this.isStatementKeyword(this.peek().value))     {
const token = this.peek()      ;
let id: AST.Identifier      ;
if (token.type === TokenType.Keyword)       {
this.advance()        ;
id = { kind: 'Identifier', name: token.value, span: this.createSpanFrom(token) }        ;
      } else       {
id = this.parseIdentifier()        ;
      }if (this.peek().value === '<' && !this.peek().wsBefore)       {
const next = this.peekNext()        ;
if (next && next.type !== TokenType.NumericLiteral && next.type === TokenType.Identifier)         {
const genericArgs = this.tryParseGenericArgs()          ;
if (genericArgs)           {
          }        }      }return this.parsePostfix(id)      ;
    }if (this.match('('))     {
const checkpoint = this.current      ;
const isLambda = this.checkParenthesizedLambda()      ;
this.current = checkpoint      ;
if (isLambda)       {
return this.parseLambda()        ;
      }const start = this.current - 1      ;
while (this.peek().virtualSemi)       {
this.advance()        ;
      }const expr = this.parseExpression()      ;
while (this.peek().virtualSemi)       {
this.advance()        ;
      }if (this.check('for'))       {
return this.parseGeneratorComprehension(expr, start)        ;
      }this.must(')', { recoverWithSynthetic: true })      ;
return this.parsePostfix(expr)      ;
    }if (this.match('['))     {
return this.parseArrayLiteral()      ;
    }if (this.match('{'))     {
return this.parseObjectLiteral()      ;
    }if (this.checkLambda())     {
return this.parseLambda()      ;
    }if (this.match('new'))     {
return this.parseNewExpression()      ;
    }if (this.match('throw'))     {
const start = this.current - 1      ;
const argument = this.parseExpression()      ;
return { kind: 'Unary', op: 'throw', argument, prefix: true, span: this.createSpan(start, this.current - 1) }      ;
    }if (this.match('match'))     {
const switchExpr = this.parseSwitch()      ;
return switchExpr as any      ;
    }throw this.error(this.peek(), 'Unexpected token in expression')    ;
  }parsePostfix(expr: AST.Expr): AST.Expr   {
while (true)     {
if (this.match('('))       {
if (expr.kind === 'Identifier' && expr.name === 'make')         {
if (this.check('<-') || this.peek().value === 'chan')           {
const typeNode = this.parseType()            ;
const typeExpr: AST.Identifier = { kind: 'Identifier', name: this.typeNodeToString(typeNode), originalSpelling: this.typeNodeToString(typeNode), span: typeNode.span }            ;
const args: AST.Expr<> = [typeExpr]            ;
while (this.match(','))             {
args.push(this.parseAssignmentExpression())              ;
            }this.must(')', { recoverWithSynthetic: true })            ;
expr = { kind: 'Call', callee: expr, args, span: this.createSpanFrom(expr) }            ;
continue            ;
          }        }const args = this.parseArguments()        ;
this.must(')', { recoverWithSynthetic: true })        ;
expr = { kind: 'Call', callee: expr, args, span: this.createSpanFrom(expr) }        ;
continue        ;
      }if (this.peek().value === '?.')       {
const next = this.peekNext()        ;
if (typeofprocess !== 'undefined' && process.env.DEBUG_PARSER)         {
console.log('Found ?. at position', this.current, 'next token:', next?.value)          ;
        }if (next?.value === '[')         {
this.advance()          ;
this.advance()          ;
const index = this.parseExpression()          ;
this.consume(']', 'Expected \']\' after index')          ;
expr = { kind: 'Index', object: expr, index, optional: true, span: this.createSpanFrom(expr) }          ;
continue          ;
        } else         {
if (next && next.type === TokenType.Identifier)           {
this.advance()            ;
const property = this.parseIdentifier()            ;
expr = { kind: 'Member', object: expr, property, optional: true, span: this.createSpanFrom(expr) }            ;
continue            ;
          }        }      }if (this.match('['))       {
const index = this.parseExpression()        ;
this.consume(']', 'Expected \']\' after index')        ;
expr = { kind: 'Index', object: expr, index, optional: false, span: this.createSpanFrom(expr) }        ;
continue        ;
      }if (this.match('.', '.*', '!.'))       {
const op = this.previous()?.value        ;
const deref = op === '.*'        ;
const forceUnwrap = op === '!.'        ;
if (deref && this.match('.'))         {
const property = this.parseIdentifier()          ;
expr = { kind: 'Member', object: { kind: 'Unary', op: '*', argument: expr, prefix: true, span: expr.span }, property, optional: false, span: this.createSpanFrom(expr) }          ;
        } else         {
if (!deref)           {
const property = this.parseIdentifier()            ;
if (forceUnwrap)             {
expr = { kind: 'Member', object: { kind: 'Unary', op: '!', argument: expr, prefix: false, span: expr.span }, property, optional: false, span: this.createSpanFrom(expr) }              ;
            } else             {
expr = { kind: 'Member', object: expr, property, optional: false, span: this.createSpanFrom(expr) }              ;
            }          }        }continue        ;
      } else       {
if (this.check('.') && this.peekNext()?.value === '*')         {
this.advance()          ;
this.advance()          ;
if (this.match('.'))           {
const property = this.parseIdentifier()            ;
expr = { kind: 'Member', object: { kind: 'Unary', op: '*', argument: expr, prefix: true, span: expr.span }, property, optional: false, span: this.createSpanFrom(expr) }            ;
          } else           {
expr = { kind: 'Unary', op: '*', argument: expr, prefix: true, span: this.createSpanFrom(expr) }            ;
          }continue          ;
        }      }if (this.match('++', '--'))       {
const op = this.previous()        ;
expr = { kind: 'Unary', op: op?.value || '', argument: expr, prefix: false, span: this.createSpanFrom(expr) }        ;
continue        ;
      }if (this.check('!'))       {
const next = this.peekNext()        ;
if (!next || !this.isUnaryOp(next))         {
this.advance()          ;
expr = { kind: 'Unary', op: '!', argument: expr, prefix: false, span: this.createSpanFrom(expr) }          ;
continue          ;
        }      }break      ;
    }return expr    ;
  }parseImport(): AST.Import   {
const start = this.current - 1    ;
let alias: AST.Identifier | undefined    ;
let path: string    ;
if (this.check('{'))     {
this.advance()      ;
while (!this.check('}') && !this.isAtEnd())       {
this.advance()        ;
      }if (this.check('}'))       {
this.advance()        ;
      }if (this.match('from'))       {
if (this.peek().type === TokenType.StringLiteral)         {
const token = this.advance()          ;
path = token.value.slice(1, -1)          ;
        } else         {
throw this.error(this.peek(), 'Expected import path after \'from\'')          ;
        }      } else       {
throw this.error(this.peek(), 'Expected \'from\' after import specifiers')        ;
      }    }if (this.check('*'))     {
else      ;
    }    {
this.advance()      ;
if (this.match('as'))       {
alias = this.parseIdentifier()        ;
      }if (this.match('from'))       {
if (this.peek().type === TokenType.StringLiteral)         {
const token = this.advance()          ;
path = token.value.slice(1, -1)          ;
        } else         {
throw this.error(this.peek(), 'Expected import path after \'from\'')          ;
        }      } else       {
throw this.error(this.peek(), 'Expected \'from\' after namespace import')        ;
      }    }if (this.peek().type === TokenType.Identifier)     {
else      ;
    }    {
const maybeDefault = this.peek()      ;
const nextToken = this.peekNext()      ;
if (nextToken && nextToken.value === ',')       {
alias = this.parseIdentifier()        ;
this.consume(',', 'Expected \',\'')        ;
if (this.check('{'))         {
this.advance()          ;
while (!this.check('}') && !this.isAtEnd())           {
this.advance()            ;
          }if (this.check('}'))           {
this.advance()            ;
          }        }if (this.match('from'))         {
if (this.peek().type === TokenType.StringLiteral)           {
const token = this.advance()            ;
path = token.value.slice(1, -1)            ;
          } else           {
throw this.error(this.peek(), 'Expected import path after \'from\'')            ;
          }        } else         {
throw this.error(this.peek(), 'Expected \'from\' after import specifiers')          ;
        }      }if (nextToken && nextToken.value === 'from')       {
else        ;
      }      {
alias = this.parseIdentifier()        ;
this.consume('from', 'Expected \'from\'')        ;
if (this.peek().type === TokenType.StringLiteral)         {
const token = this.advance()          ;
path = token.value.slice(1, -1)          ;
        } else         {
throw this.error(this.peek(), 'Expected import path after \'from\'')          ;
        }      }else      ;
      {
path = this.advance().value        ;
if (this.match('as'))         {
alias = this.parseIdentifier()          ;
        }      }    }if (this.peek().type === TokenType.StringLiteral)     {
else      ;
    }    {
const token = this.advance()      ;
path = token.value.slice(1, -1)      ;
if (this.match('as'))       {
alias = this.parseIdentifier()        ;
      }    }else    ;
    {
throw this.error(this.peek(), 'Expected import path')      ;
    }this.consumeSemicolon()    ;
return { kind: 'Import', path: path!, alias, span: this.createSpan(start, this.current - 1) }    ;
  }parseVarDecl(): AST.VarDecl   {
const start = this.current - 1    ;
const names = this.parseIdentifierList()    ;
let type: AST.TypeNode | undefined    ;
if (this.match(':'))     {
type = this.parseType()      ;
    }let values: AST.Expr<> | undefined    ;
if (this.match('='))     {
values = this.parseExpressionList()      ;
    }this.consumeSemicolon()    ;
return { kind: 'VarDecl', names, type, values, span: this.createSpan(start, this.current - 1) }    ;
  }parseConstDecl(): AST.ConstDecl   {
const start = this.current - 1    ;
const names = this.parseIdentifierList()    ;
let type: AST.TypeNode | undefined    ;
if (this.match(':'))     {
type = this.parseType()      ;
    }this.consume('=', 'Const declaration requires initialization')    ;
const values = this.parseExpressionList()    ;
this.consumeSemicolon()    ;
return { kind: 'ConstDecl', names, type, values, span: this.createSpan(start, this.current - 1) }    ;
  }peekAhead(value: string): boolean   {
const checkpoint = this.current    ;
let depth = 0    ;
if (this.peek().value === '{' || this.peek().value === '[')     {
const openBracket = this.peek().value      ;
const closeBracket = openBracket === '{' ? '}' : ']'      ;
this.advance()      ;
depth = 1      ;
while (depth > 0 && !this.isAtEnd())       {
if (this.peek().value === openBracket)         {
depth++          ;
        } else         {
if (this.peek().value === closeBracket)           {
depth--            ;
          }        }this.advance()        ;
      }const found = this.peek().value === value      ;
this.current = checkpoint      ;
return found      ;
    }this.current = checkpoint    ;
return false    ;
  }parseDestructuringShortDecl(): AST.ShortDecl   {
const start = this.current    ;
const pattern = this.parseExpression()    ;
this.consume(':=', 'Expected \':=\' in destructuring declaration')    ;
const value = this.parseExpression()    ;
this.consumeSemicolon()    ;
return { kind: 'ShortDecl', pairs: [{ name: { kind: 'Identifier', name: '__destructured', span: pattern.span }, expr: { kind: 'Assign', left: pattern, right: value, op: '=', span: this.createSpan(start, this.current - 1) } }], span: this.createSpan(start, this.current - 1) }    ;
  }parseShortDecl(): AST.ShortDecl   {
const start = this.current    ;
const pairs: AST.ShortDeclPair<> = []    ;
const checkpoint = this.current    ;
const firstToken = this.peek()    ;
if (firstToken.type === TokenType.Identifier)     {
const name = this.parseIdentifier()      ;
this.consume(':=', 'Expected \':=\' in short declaration')      ;
const expr = this.parseExpression()      ;
pairs.push({ name, expr })      ;
while (this.match(','))       {
const nextName = this.parseIdentifier()        ;
this.consume(':=', 'Expected \':=\' in short declaration')        ;
const nextExpr = this.parseExpression()        ;
pairs.push({ name: nextName, expr: nextExpr })        ;
      }    }this.consumeSemicolon()    ;
return { kind: 'ShortDecl', pairs, span: this.createSpan(start, this.current - 1) }    ;
  }parseFuncDecl(async = false , unsafe = false , generator = false): AST.FuncDecl   {
const start = this.current - 1    ;
const name = this.parseIdentifier()    ;
let genericParams: AST.Identifier<> | undefined    ;
if (this.match('<'))     {
genericParams = []      ;
this.consume('>', 'Expected \'>\' after generic parameters')      ;
    }const params = this.parseParameterList()    ;
let returnType: AST.TypeNode | undefined    ;
if (this.match('->'))     {
returnType = this.parseType()      ;
if (!this.check(':') && !this.check('{') && !this.check('=>'))       {
      }    } else     {
if (this.check(':'))       {
const checkpoint = this.current        ;
this.advance()        ;
const nextToken = this.peek()        ;
const prevIndent = this.tokens[checkpoint]?.indentCol ?? 0        ;
const nextIndent = nextToken.indentCol        ;
if (nextToken.virtualSemi || nextIndent !== null && nextIndent > prevIndent)         {
        } else         {
if (this.check('return') || this.check('pass') || this.check('raise') || this.check('yield') || this.check('this') || this.check('super'))           {
          } else           {
returnType = this.parseType()            ;
          }        }      }    }let body: AST.Block    ;
if (this.match('=>'))     {
body = this.parseExpressionBody()      ;
    } else     {
if (this.match(':') || this.previous()?.value === ':')       {
const currentIndent = this.current > 0 ? this.tokens[this.current - 1]?.indentCol ?? 0 : 0        ;
const peekIndent = this.peek().indentCol        ;
if (this.peek().virtualSemi || peekIndent !== null && peekIndent > currentIndent)         {
body = this.parseIndentBlock()          ;
        } else         {
const stmt = this.parseStatement()          ;
body = { kind: 'Block', statements: stmt ? [stmt] : [], span: this.createSpanFrom(stmt || this.previous()) }          ;
        }      } else       {
if (this.check('{'))         {
body = this.parseBlock()          ;
        } else         {
const statements: Array<AST.Decl | AST.Stmt> = []          ;
while (!this.check('end') && !this.isAtEnd())           {
if (this.peek().virtualSemi)             {
this.advance()              ;
continue              ;
            }try             {
const stmt = this.parseTopLevel()              ;
if (stmt)               {
statements.push(stmt)                ;
              }            } catch (error)             {
if (error instanceof ParseError)               {
this.errors.push(error)                ;
this.synchronize()                ;
              } else               {
throw error                ;
              }            }          }this.consume('end', 'Expected \'end\' to close function')          ;
body = { kind: 'Block', statements, span: this.createSpan(start, this.current - 1) }          ;
        }      }    }return { kind: 'FuncDecl', name, genericParams, params, returnType, async, unsafe, generator, body: body as AST.Block, span: this.createSpan(start, this.current - 1) }    ;
  }parseFuncDeclWithReturnTypeBefore(): AST.FuncDecl   {
const start = this.current    ;
const returnType = this.parseType()    ;
const name = this.parseIdentifier()    ;
const params = this.parseParameterList()    ;
const body = this.match('=>') ? this.parseExpressionBody() : this.parseBlock()    ;
return { kind: 'FuncDecl', name, genericParams: null, params, returnType, async: false, unsafe: false, body: body as AST.Block, span: this.createSpan(start, this.current - 1) }    ;
  }parseParameterList(): AST.Param<>   {
this.consume('(', 'Expected \'(\' before parameters')    ;
const params: AST.Param<> = []    ;
while (this.peek().virtualSemi)     {
this.advance()      ;
    }if (!this.check(')'))     {
    }while (this.peek().virtualSemi)     {
this.advance()      ;
    }this.consume(')', 'Expected \')\' after parameters')    ;
return params    ;
  }parseParameter(): AST.Param   {
const start = this.current    ;
while (this.check('@'))     {
this.advance()      ;
if (this.peek().type === TokenType.Identifier)       {
this.advance()        ;
if (this.check('('))         {
this.advance()          ;
let depth = 1          ;
while (depth > 0 && !this.isAtEnd())           {
if (this.check('('))             {
depth++              ;
            } else             {
if (this.check(')'))               {
depth--                ;
              }            }this.advance()            ;
          }        }      }    }let visibility: "public" | "private" | "protected" | undefined    ;
if (this.match('public', 'private', 'protected'))     {
visibility = this.previous()!.value as any      ;
    }let readonly = false    ;
if (this.match('readonly'))     {
readonly = true      ;
    }let isBlockParam = false    ;
if (this.match('&'))     {
isBlockParam = true      ;
    }let isSpread = false    ;
if (this.match('...'))     {
isSpread = true      ;
    }let name: AST.Identifier    ;
const token = this.peek()    ;
if (token.type === TokenType.Identifier || token.type === TokenType.Keyword || token.type === TokenType.SigilIdentifier)     {
this.advance()      ;
name = { kind: 'Identifier', name: token.value, originalSpelling: token.value, span: this.createSpanFrom(token) }      ;
    } else     {
name = this.parseIdentifier()      ;
    }let optional = false    ;
if (this.match('?'))     {
optional = true      ;
    }let type: AST.TypeNode | undefined    ;
if (this.match(':'))     {
type = this.parseType()      ;
    }let defaultValue: AST.Expr | undefined    ;
if (this.match('='))     {
defaultValue = this.parseExpression()      ;
    }return { name, type, defaultValue, visibility, readonly, spread: isSpread, blockParam: isBlockParam, span: this.createSpan(start, this.current - 1) }    ;
  }parseExpressionBody(): AST.Block   {
const expr = this.parseExpression()    ;
return { kind: 'Block', statements: [{ kind: 'Return', values: [expr], span: expr.span }], span: expr.span }    ;
  }parseIf(): AST.If   {
const start = this.current - 1    ;
const arms: AST.IfArm<> = []    ;
let isBashStyle = false    ;
let test: AST.Expr    ;
if (this.check('['))     {
test = this.parseBashTestExpression()      ;
    } else     {
test = this.parseExpression()      ;
    }if (this.match(':'))     {
const body = this.parseIndentBlock()      ;
arms.push({ test, body, span: this.createSpan(start, this.current - 1) })      ;
    } else     {
if (this.check(';') && this.peekNext()?.value === 'then')       {
this.advance()        ;
this.consume('then', 'Expected \'then\' after if condition in bash-style')        ;
const body = this.parseIfThenBlock()        ;
arms.push({ test, body, span: this.createSpan(start, this.current - 1) })        ;
isBashStyle = true        ;
      } else       {
if (this.match('then'))         {
const body = this.parseIfThenBlock()          ;
arms.push({ test, body, span: this.createSpan(start, this.current - 1) })          ;
isBashStyle = true          ;
        } else         {
const body = this.parseBlockOrStatement()          ;
arms.push({ test, body, span: this.createSpan(start, this.current - 1) })          ;
        }      }    }while (this.match('elif', 'elseif'))     {
const elifTest = this.parseExpression()      ;
let elifBody: AST.Block      ;
if (this.match(':'))       {
elifBody = this.parseIndentBlock()        ;
      } else       {
if (isBashStyle && this.match(';') || this.match('then'))         {
if (this.previous()?.value === ';')           {
this.consume('then', 'Expected \'then\' after elif condition')            ;
          }elifBody = this.parseIfThenBlock()          ;
        } else         {
elifBody = this.parseBlockOrStatement()          ;
        }      }arms.push({ test: elifTest, body: elifBody, span: this.createSpan(this.current - 1, this.current) })      ;
    }let elseBody: AST.Block | undefined    ;
if (this.match('else'))     {
if (this.match('if'))       {
const elseIf = this.parseIf()        ;
elseBody = { kind: 'Block', statements: [elseIf], span: elseIf.span }        ;
      } else       {
if (this.match(':'))         {
elseBody = this.parseIndentBlock()          ;
        } else         {
if (isBashStyle)           {
elseBody = this.parseIfThenBlock()            ;
          } else           {
elseBody = this.parseBlockOrStatement()            ;
          }        }      }    }if (isBashStyle)     {
this.consume('fi', 'Expected \'fi\' to close if statement')      ;
    }return { kind: 'If', arms, elseBody, span: this.createSpan(start, this.current - 1) }    ;
  }parseSwitch(): AST.Switch   {
const start = this.current - 1    ;
const isMatch = this.previous()?.value === 'match'    ;
const discriminant = this.parseExpression()    ;
const cases: AST.SwitchCase<> = []    ;
let defaultCase: AST.Block | undefined    ;
const wasInsideSwitch = this.insideSwitch    ;
this.insideSwitch = true    ;
const isPythonStyle = this.check(':')    ;
let baseIndent = 0    ;
if (isPythonStyle)     {
this.consume(':', 'Expected \':\' after match expression')      ;
baseIndent = this.tokens[this.current - 1]?.indentCol ?? 0      ;
while (this.peek().virtualSemi)       {
this.advance()        ;
      }    } else     {
this.consume('{', 'Expected \'{\' after switch expression')      ;
    }while (!this.isAtEnd())     {
if (isPythonStyle)       {
const currentIndent = this.peek().indentCol        ;
if (currentIndent !== null && currentIndent <= baseIndent)         {
break          ;
        }      } else       {
if (this.check('}'))         {
break          ;
        }      }while (this.peek().virtualSemi)       {
this.advance()        ;
      }if (!isPythonStyle && this.check('}'))       {
break        ;
      }if (this.isAtEnd())       {
break        ;
      }const caseStart = this.current      ;
if (this.match('default'))       {
this.consume(':', 'Expected \':\' after default')        ;
defaultCase = this.parseCaseBody()        ;
if (isMatch && this.check(','))         {
this.advance()          ;
        }continue        ;
      }const patterns: AST.Expr<> = []      ;
if (isMatch && this.check('_'))       {
const wildcardStart = this.current        ;
this.advance()        ;
while (this.peek().virtualSemi)         {
this.advance()          ;
        }if (this.check('=>'))         {
this.consume('=>', 'Expected \'=>\' after wildcard pattern')          ;
defaultCase = this.parseMatchCaseBody()          ;
if (this.check(','))           {
this.advance()            ;
          }continue          ;
        } else         {
this.current = wildcardStart          ;
        }      }if (this.match('case'))       {
patterns.push(this.parseExpression())        ;
while (this.match(','))         {
patterns.push(this.parseExpression())          ;
        }      } else       {
if (isMatch && !this.check('}'))         {
patterns.push(this.parseMatchPattern())          ;
while (this.match('|'))           {
patterns.push(this.parseMatchPattern())            ;
          }        } else         {
break          ;
        }      }let guard: AST.Expr | undefined      ;
if (this.match('if'))       {
guard = this.parseExpression()        ;
      }if (isMatch && !isPythonStyle)       {
this.consume('=>', 'Expected \'=>\' after match pattern')        ;
      } else       {
this.consume(':', 'Expected \':\' after case pattern')        ;
      }const body = isMatch ? this.parseMatchCaseBody() : this.parseCaseBody()      ;
const fallthrough = this.checkFallthrough()      ;
cases.push({ patterns, guard, body, fallthrough, span: this.createSpan(caseStart, this.current - 1) })      ;
if (isMatch && this.check(','))       {
this.advance()        ;
      }    }if (!isPythonStyle)     {
this.consume('}', 'Expected \'}\' after switch body')      ;
    }this.insideSwitch = wasInsideSwitch    ;
return { kind: 'Switch', discriminant, cases, defaultCase, span: this.createSpan(start, this.current - 1) }    ;
  }parseMatchPattern(): AST.Expr   {
const start = this.current    ;
while (this.peek().virtualSemi)     {
this.advance()      ;
    }if (this.match('_'))     {
return { kind: 'Identifier', name: '_', span: this.createSpan(start, this.current - 1) }      ;
    }if (this.peek().type === TokenType.NumericLiteral)     {
return this.parseNumericLiteral()      ;
    }if (this.peek().type === TokenType.StringLiteral)     {
return this.parseStringLiteral()      ;
    }if (this.match('true', 'false'))     {
const token = this.previous()      ;
return { kind: 'BooleanLiteral', value: token?.value === 'true', span: this.createSpanFrom(token!) }      ;
    }if (this.match('null', 'undefined', 'nil', 'None'))     {
return { kind: 'NullLiteral', span: this.createSpanFrom(this.previous()!) }      ;
    }if (this.match('['))     {
return this.parseArrayLiteral()      ;
    }if (this.match('{'))     {
return this.parseObjectLiteral()      ;
    }const id = this.parseIdentifier()    ;
if (this.match('('))     {
const args: AST.Expr<> = []      ;
if (!this.check(')'))       {
      }this.consume(')', 'Expected \')\' after constructor arguments')      ;
return { kind: 'Call', callee: id, args, span: this.createSpan(start, this.current - 1) }      ;
    }return id    ;
  }parseCaseBody(): AST.Block   {
const statements: Array<AST.Decl | AST.Stmt> = []    ;
while (!this.check('case') && !this.check('default') && !this.check('}') && !this.isAtEnd())     {
const stmt = this.parseTopLevel()      ;
if (stmt)       {
statements.push(stmt)        ;
      }if (stmt && stmt.kind === 'Break')       {
break        ;
      }    }return { kind: 'Block', statements, span: this.createSpanFrom(statements[0] || this.previous()) }    ;
  }parseMatchCaseBody(): AST.Block   {
if (this.check('{'))     {
return this.parseBlock()      ;
    }const expr = this.parseAssignmentExpression()    ;
if (this.check(','))     {
    }return { kind: 'Block', statements: [{ kind: 'ExprStmt', expr, span: expr.span }], span: expr.span }    ;
  }checkFallthrough(): boolean   {
const next = this.peek()    ;
if (next.type === TokenType.Keyword && next.value === 'fallthrough')     {
this.advance()      ;
this.consumeSemicolon()      ;
return true      ;
    }return false    ;
  }parseDoStatement(): AST.Stmt   {
const start = this.current - 1    ;
const startToken = this.tokens[start - 1]    ;
const body = this.parseBlock()    ;
if (this.match('while'))     {
this.consume('(', 'Expected \'(\' after \'while\' in do-while loop')      ;
const test = this.parseExpression()      ;
this.consume(')', 'Expected \')\' after condition in do-while loop')      ;
this.consumeSemicolon()      ;
return { kind: 'Loop', mode: 'do-while', body, test, span: this.createSpan(start, this.current - 1) }      ;
    } else     {
if (this.check('done'))       {
this.consume('done', 'Expected \'done\' to close do block')        ;
return { kind: 'Block', statements: body.statements, span: this.createSpan(start, this.current - 1) }        ;
      } else       {
throw this.error(this.peek(), 'Expected \'while\' or \'done\' after do block')        ;
      }    }  }parseLoop(): AST.Loop   {
const start = this.current - 1    ;
const keyword = this.previous()?.value || ''    ;
if (keyword === 'loop')     {
const body = this.parseBlock()      ;
return { kind: 'Loop', mode: 'infinite', body, span: this.createSpan(start, this.current - 1) }      ;
    }if (keyword === 'for')     {
const isAwait = this.match('await')      ;
if (this.peek().type === TokenType.Identifier || isAwait && this.check('('))       {
if (isAwait)         {
this.consume('(', 'Expected \'(\' after \'for await\'')          ;
let variable: AST.Identifier          ;
if (this.match('const', 'let', 'var'))           {
variable = this.parseIdentifier()            ;
          } else           {
variable = this.parseIdentifier()            ;
          }this.consume('of', 'Expected \'of\' in for-await loop')          ;
const iterable = this.parseExpression()          ;
this.consume(')', 'Expected \')\' after for-await')          ;
const body = this.parseBlock()          ;
return { kind: 'Loop', mode: 'foreach', variable, iterable, body, await: true, span: this.createSpan(start, this.current - 1) }          ;
        } else         {
const checkpoint = this.current          ;
const id = this.advance()          ;
if (this.match('in'))           {
const variable = { kind: 'Identifier' as const, name: id.value, span: this.createSpanFrom(id) }            ;
const iterable = this.parseExpression()            ;
const body = this.parseBlockOrStatement()            ;
return { kind: 'Loop', mode: 'foreach', variable, iterable, body, span: this.createSpan(start, this.current - 1) }            ;
          }this.current = checkpoint          ;
        }      }if (this.peek().type === TokenType.Identifier && this.peekAt(1)?.value === ':=')       {
const initStart = this.current        ;
const name = this.parseIdentifier()        ;
this.consume(':=', 'Expected \':=\' in for init')        ;
const expr = this.parseExpression()        ;
const init: AST.ShortDecl = { kind: 'ShortDecl', pairs: [{ name, expr }], span: this.createSpan(initStart, this.current - 1) }        ;
this.consume(';', 'Expected \';\' after init')        ;
let test: AST.Expr | undefined        ;
if (!this.check(';'))         {
test = this.parseExpression()          ;
        }this.consume(';', 'Expected \';\' after loop condition')        ;
let step: AST.Expr | undefined        ;
if (!this.check('{'))         {
step = this.parseExpression()          ;
        }const body = this.parseBlockOrStatement()        ;
return { kind: 'Loop', mode: 'for', init, test, step, body, span: this.createSpan(start, this.current - 1) }        ;
      }this.consume('(', 'Expected \'(\' after \'for\'')      ;
if (this.check('const') || this.check('let') || this.check('var'))       {
const checkpoint = this.current        ;
const declKeyword = this.advance()        ;
if (this.peek().type === TokenType.Identifier)         {
const variable = this.parseIdentifier()          ;
if (this.match('of', 'in'))           {
const iterType = this.previous()?.value            ;
const iterable = this.parseExpression()            ;
this.consume(')', 'Expected \')\' after for-of/for-in')            ;
const body = this.parseBlockOrStatement()            ;
return { kind: 'Loop', mode: 'foreach', variable, iterable, body, span: this.createSpan(start, this.current - 1) }            ;
          }        }this.current = checkpoint        ;
      }if (this.peek().type === TokenType.Identifier)       {
const checkpoint = this.current        ;
const variable = this.parseIdentifier()        ;
if (this.match('of', 'in'))         {
const iterType = this.previous()?.value          ;
const iterable = this.parseExpression()          ;
this.consume(')', 'Expected \')\' after for-of/for-in')          ;
const body = this.parseBlockOrStatement()          ;
return { kind: 'Loop', mode: 'foreach', variable, iterable, body, span: this.createSpan(start, this.current - 1) }          ;
        }this.current = checkpoint        ;
      }let init: AST.Stmt | AST.Decl | undefined      ;
if (!this.check(';'))       {
if (this.isDeclStart())         {
init = this.parseDeclaration()          ;
        } else         {
init = this.parseExprStmt()          ;
        }      } else       {
this.advance()        ;
      }while (this.peek().virtualSemi)       {
this.advance()        ;
      }let test: AST.Expr | undefined      ;
if (!this.check(';'))       {
test = this.parseExpression()        ;
      }this.consume(';', 'Expected \';\' after loop condition')      ;
let step: AST.Expr | undefined      ;
if (!this.check(')'))       {
step = this.parseExpression()        ;
      }this.consume(')', 'Expected \')\' after for clauses')      ;
const body = this.parseBlockOrStatement()      ;
return { kind: 'Loop', mode: 'for', init, test, step, body, span: this.createSpan(start, this.current - 1) }      ;
    }if (keyword === 'while')     {
let test: AST.Expr      ;
if (this.check('['))       {
test = this.parseBashTestExpression()        ;
      } else       {
test = this.parseExpression()        ;
      }if (this.check(';') && this.peekNext()?.value === 'do')       {
this.advance()        ;
      }let body: AST.Block      ;
if (this.match('do'))       {
body = this.parseKeywordBlock('do')        ;
      } else       {
body = this.parseBlockOrStatement()        ;
      }return { kind: 'Loop', mode: 'while', test, body, span: this.createSpan(start, this.current - 1) }      ;
    }if (keyword === 'until')     {
let test: AST.Expr      ;
if (this.check('['))       {
test = this.parseBashTestExpression()        ;
      } else       {
test = this.parseExpression()        ;
      }if (this.check(';') && this.peekNext()?.value === 'do')       {
this.advance()        ;
      }let body: AST.Block      ;
if (this.match('do'))       {
body = this.parseKeywordBlock('do')        ;
      } else       {
body = this.parseBlockOrStatement()        ;
      }return { kind: 'Loop', mode: 'until', test, body, span: this.createSpan(start, this.current - 1) }      ;
    }throw this.error(this.peek(), 'Invalid loop type')    ;
  }parseForeach(): AST.Loop   {
const start = this.current - 1    ;
const variable = this.parseIdentifier()    ;
this.consume('in', 'Expected \'in\' in foreach loop')    ;
const iterable = this.parseExpression()    ;
let body: AST.Block    ;
if (this.match('do'))     {
body = this.parseKeywordBlock('do')      ;
    } else     {
body = this.parseBlockOrStatement()      ;
    }return { kind: 'Loop', mode: 'foreach', variable, iterable, body, span: this.createSpan(start, this.current - 1) }    ;
  }parseTry(): AST.Try   {
const start = this.current - 1    ;
let body: AST.Block    ;
if (this.match(':'))     {
if (this.checkIndentBlock())       {
body = this.parseIndentBlock()        ;
      } else       {
const stmt = this.parseStatement()        ;
body = { kind: 'Block', statements: [stmt], span: stmt.span }        ;
      }    } else     {
body = this.parseBlock()      ;
    }const catches: AST.CatchClause<> = []    ;
while (this.match('catch', 'except', 'rescue'))     {
const clauseType = this.previous()?.value      ;
let param: AST.Identifier | undefined      ;
let type: AST.TypeNode | undefined      ;
if (clauseType === 'except' && this.check(':'))       {
if (this.peek().type === TokenType.Identifier && !this.check(':'))         {
type = this.parseType()          ;
if (this.match('as'))           {
param = this.parseIdentifier()            ;
          }        }this.consume(':', 'Expected \':\' after except clause')        ;
let catchBody: AST.Block        ;
if (this.checkIndentBlock())         {
catchBody = this.parseIndentBlock()          ;
        } else         {
const stmt = this.parseStatement()          ;
catchBody = { kind: 'Block', statements: [stmt], span: stmt.span }          ;
        }catches.push({ param, type, body: catchBody, span: this.createSpan(this.current - 1, this.current) })        ;
      } else       {
if (clauseType === 'rescue')         {
if (this.peek().type === TokenType.Identifier && !this.check('=>'))           {
type = this.parseType()            ;
          }if (this.match('=>'))           {
param = this.parseIdentifier()            ;
          }const rescueStatements: Array<AST.Decl | AST.Stmt> = []          ;
while (!this.check('rescue') && !this.check('ensure') && !this.check('end') && !this.check('finally') && !this.check('except') && !this.isAtEnd())           {
if (this.peek().virtualSemi)             {
this.advance()              ;
continue              ;
            }const beforePos = this.current            ;
try             {
const stmt = this.parseTopLevel()              ;
if (stmt)               {
rescueStatements.push(stmt)                ;
              }            } catch (error)             {
if (error instanceof ParseError)               {
this.errors.push(error)                ;
this.synchronize()                ;
              } else               {
throw error                ;
              }            }if (this.current === beforePos)             {
this.advance()              ;
            }          }catches.push({ param, type, body: { kind: 'Block', statements: rescueStatements, span: this.createSpan(this.current - 1, this.current) }, span: this.createSpan(this.current - 1, this.current) })          ;
        } else         {
if (this.match('('))           {
if (!this.check(')'))             {
param = this.parseIdentifier()              ;
if (this.match(':'))               {
type = this.parseType()                ;
              }            }this.consume(')', 'Expected \')\' after catch clause')            ;
const catchBody = this.parseBlock()            ;
catches.push({ param, type, body: catchBody, span: this.createSpan(this.current - 1, this.current) })            ;
          } else           {
const catchBody = this.parseBlock()            ;
catches.push({ param, type, body: catchBody, span: this.createSpan(this.current - 1, this.current) })            ;
          }        }      }    }let finallyBody: AST.Block | undefined    ;
if (this.match('finally'))     {
if (this.match(':'))       {
if (this.checkIndentBlock())         {
finallyBody = this.parseIndentBlock()          ;
        } else         {
const stmt = this.parseStatement()          ;
finallyBody = { kind: 'Block', statements: [stmt], span: stmt.span }          ;
        }      } else       {
finallyBody = this.parseBlock()        ;
      }    }return { kind: 'Try', body, catches, finallyBody, span: this.createSpan(start, this.current - 1) }    ;
  }parseUsing(): AST.Using   {
const start = this.current - 1    ;
let resource: AST.Expr | AST.Decl    ;
const expr = this.parseExpression()    ;
if (this.match('as'))     {
const alias = this.parseIdentifier()      ;
resource = { kind: 'VarDecl', names: [alias], values: [expr], span: this.createSpan(start, this.current - 1) } as AST.VarDecl      ;
    } else     {
if (this.isDeclStart())       {
this.current = start + 1        ;
resource = this.parseDeclaration()        ;
      } else       {
resource = expr        ;
      }    }let body: AST.Block    ;
if (this.match(':'))     {
if (this.checkIndentBlock())       {
body = this.parseIndentBlock()        ;
      } else       {
const stmt = this.parseStatement()        ;
body = { kind: 'Block', statements: [stmt], span: stmt.span }        ;
      }    } else     {
body = this.parseBlock()      ;
    }return { kind: 'Using', resource, body, span: this.createSpan(start, this.current - 1) }    ;
  }parseDefer(): AST.Defer   {
const start = this.current - 1    ;
let body: AST.Block | AST.Expr    ;
if (this.check('{'))     {
body = this.parseBlock()      ;
    } else     {
body = this.parseExpression()      ;
this.consumeSemicolon()      ;
    }return { kind: 'Defer', body, span: this.createSpan(start, this.current - 1) }    ;
  }parseBreak(): AST.Break   {
const start = this.current - 1    ;
let label: AST.Identifier | undefined    ;
if (this.peek().type === TokenType.Identifier || this.peek().type === TokenType.Keyword && !this.check(';'))     {
const token = this.advance()      ;
label = { kind: 'Identifier', name: token.value, span: this.createSpanFrom(token) }      ;
    }this.consumeSemicolon()    ;
return { kind: 'Break', label, span: this.createSpan(start, this.current - 1) }    ;
  }parseContinue(): AST.Continue   {
const start = this.current - 1    ;
let label: AST.Identifier | undefined    ;
if (this.peek().type === TokenType.Identifier || this.peek().type === TokenType.Keyword && !this.check(';'))     {
const token = this.advance()      ;
label = { kind: 'Identifier', name: token.value, span: this.createSpanFrom(token) }      ;
    }this.consumeSemicolon()    ;
return { kind: 'Continue', label, span: this.createSpan(start, this.current - 1) }    ;
  }parseReturn(): AST.Return   {
const start = this.current - 1    ;
const values: AST.Expr<> = []    ;
if (!this.checkSemicolon() && !this.isAtEnd())     {
values.push(...this.parseExpressionList())      ;
    }this.consumeSemicolon()    ;
return { kind: 'Return', values, span: this.createSpan(start, this.current - 1) }    ;
  }parseAssert(): AST.ExprStmt   {
const start = this.current - 1    ;
const condition = this.parseExpression()    ;
let message: AST.Expr | undefined    ;
if (this.match(','))     {
message = this.parseExpression()      ;
    }this.consumeSemicolon()    ;
const assertCall: AST.Call = { kind: 'Call', callee: { kind: 'Identifier', name: 'assert', span: this.createSpan(start, start) }, args: message ? [condition, message] : [condition], span: this.createSpan(start, this.current - 1) }    ;
return { kind: 'ExprStmt', expr: assertCall, span: this.createSpan(start, this.current - 1) }    ;
  }parseEcho(): AST.Echo   {
const start = this.current - 1    ;
const values = this.parseExpressionList()    ;
this.consumeSemicolon()    ;
return { kind: 'Echo', values, span: this.createSpan(start, this.current - 1) }    ;
  }parseThrow(): AST.Throw   {
const start = this.current - 1    ;
const value = this.parseExpression()    ;
this.consumeSemicolon()    ;
return { kind: 'Throw', value, span: this.createSpan(start, this.current - 1) }    ;
  }parseYield(): AST.Yield   {
const start = this.current - 1    ;
let value: AST.Expr | undefined    ;
let delegate = false    ;
if (this.match('*'))     {
delegate = true      ;
    }if (!this.checkSemicolon() && !this.isAtEnd())     {
value = this.parseExpression()      ;
    }this.consumeSemicolon()    ;
return { kind: 'Yield', value, delegate, span: this.createSpan(start, this.current - 1) }    ;
  }parseYieldExpression(): AST.Yield   {
const start = this.current - 1    ;
let value: AST.Expr | undefined    ;
let delegate = false    ;
if (this.match('*'))     {
delegate = true      ;
    } else     {
if (this.match('from'))       {
delegate = true        ;
      }    }if (!this.check(';') && !this.check(',') && !this.check(')') && !this.check(']') && !this.check('}') && !this.isAtEnd())     {
value = this.parseAssignmentExpression()      ;
    }return { kind: 'Yield', value, delegate, span: this.createSpan(start, this.current - 1) }    ;
  }parseGo(): AST.Go   {
const start = this.current - 1    ;
const expr = this.parseExpression()    ;
this.consumeSemicolon()    ;
return { kind: 'Go', expr, span: this.createSpan(start, this.current - 1) }    ;
  }parsePass(): AST.Pass   {
const start = this.current - 1    ;
this.consumeSemicolon()    ;
return { kind: 'Pass', span: this.createSpan(start, this.current - 1) }    ;
  }parseExprStmt(): AST.ExprStmt | AST.If   {
const expr = this.parseExpression()    ;
if (this.match(':=:'))     {
if (expr.kind !== 'Identifier')       {
throw this.error(this.previous()!, 'Reassignment requires an identifier')        ;
      }const value = this.parseExpression()      ;
this.consumeSemicolon()      ;
return { kind: 'ExprStmt', expr: { kind: 'Assign', op: ':=:', left: expr, right: value, span: this.createSpanFrom(expr) }, span: this.createSpanFrom(expr) }      ;
    }if (this.check('if') || this.check('unless'))     {
const modifier = this.peek().value      ;
this.advance()      ;
const condition = this.parseExpression()      ;
const ifStmt: AST.If = { kind: 'If', arms: [{ test: modifier === 'unless' ? { kind: 'Unary', op: '!', argument: condition, prefix: true, span: condition.span } : condition, body: { kind: 'Block', statements: [{ kind: 'ExprStmt', expr, span: expr.span }], span: expr.span }, span: this.createSpanFrom(expr) }], span: this.createSpanFrom(expr) }      ;
this.consumeSemicolon()      ;
return ifStmt      ;
    }this.consumeSemicolon()    ;
return { kind: 'ExprStmt', expr, span: expr.span }    ;
  }parseType(): AST.TypeNode   {
if (this.peek().type === TokenType.Identifier)     {
const checkpoint = this.current      ;
const paramName = this.advance()      ;
if (this.peek().value === 'is')       {
this.advance()        ;
const predicateType = this.parseSimpleType()        ;
return { kind: 'PredicateType', param: { kind: 'Identifier', name: paramName.value, span: this.createSpan(checkpoint, checkpoint) }, type: predicateType, span: this.createSpan(checkpoint, this.current - 1) } as any        ;
      } else       {
this.current = checkpoint        ;
      }    }let type = this.parseSimpleType()    ;
while (this.check('['))     {
const checkpoint = this.current      ;
this.advance()      ;
if (this.check(']'))       {
this.advance()        ;
type = { kind: 'GenericType', base: { kind: 'Identifier', name: 'Array', span: this.createSpan(checkpoint, this.current - 1) } as AST.Identifier, args: [type], span: this.createSpanFrom(type) }        ;
      } else       {
if (this.peek().type === TokenType.StringLiteral)         {
const indexToken = this.advance()          ;
this.consume(']', 'Expected \']\' after indexed access property')          ;
type = { kind: 'IndexedAccessType', object: type, index: indexToken.value, span: this.createSpanFrom(type) } as any          ;
        } else         {
this.current = checkpoint          ;
break          ;
        }      }    }if (this.match('?'))     {
type = { kind: 'NullableType', inner: type, span: this.createSpanFrom(type) }      ;
    }if (this.check('->'))     {
this.advance()      ;
const ret = this.parseType()      ;
type = { kind: 'FuncType', params: [type], ret, span: this.createSpanFrom(type) }      ;
    }if (this.match('|'))     {
else      ;
    }    {
const types: AST.TypeNode<> = [type]      ;
type = { kind: 'UnionType', types, span: this.createSpanFrom(types[0]) }      ;
    }return type    ;
  }parseSimpleType(): AST.TypeNode   {
const start = this.current    ;
if (this.peek().type === TokenType.StringLiteral)     {
const literal = this.advance()      ;
return { kind: 'SimpleType', id: { kind: 'Identifier', name: literal.value, span: this.createSpan(start, start) }, span: this.createSpan(start, this.current - 1) }      ;
    }if (this.match('<-'))     {
this.consume('chan', 'Expected \'chan\' after \'<-\'')      ;
let elementType: AST.TypeNode | undefined      ;
if (this.peek().type === TokenType.Identifier || this.check('('))       {
elementType = this.parseSimpleType()        ;
      }return { kind: 'ChanType', direction: 'receive', elementType, span: this.createSpan(start, this.current - 1) }      ;
    }if (this.peek().value === 'chan')     {
this.advance()      ;
if (this.match('<-'))       {
let elementType: AST.TypeNode | undefined        ;
if (this.peek().type === TokenType.Identifier || this.check('('))         {
elementType = this.parseSimpleType()          ;
        }return { kind: 'ChanType', direction: 'send', elementType, span: this.createSpan(start, this.current - 1) }        ;
      } else       {
let elementType: AST.TypeNode | undefined        ;
if (this.peek().type === TokenType.Identifier || this.check('('))         {
elementType = this.parseSimpleType()          ;
        }return { kind: 'ChanType', direction: 'both', elementType, span: this.createSpan(start, this.current - 1) }        ;
      }    }if (this.check('{'))     {
this.advance()      ;
let depth = 1      ;
while (depth > 0 && !this.isAtEnd())       {
if (this.check('{'))         {
depth++          ;
        } else         {
if (this.check('}'))           {
depth--            ;
if (depth === 0)             {
break              ;
            }          }        }this.advance()        ;
      }this.consume('}', 'Expected \'}\' in object type literal')      ;
return { kind: 'SimpleType', id: { kind: 'Identifier', name: 'object', span: this.createSpan(start, start) }, span: this.createSpan(start, this.current - 1) }      ;
    }if (this.check('('))     {
const checkpoint = this.current      ;
this.advance()      ;
let depth = 1      ;
while (depth > 0 && !this.isAtEnd())       {
if (this.check('('))         {
depth++          ;
        }if (this.check(')'))         {
depth--          ;
        }this.advance()        ;
      }const isFuncType = this.check('=>') || this.check('->')      ;
const arrow = this.check('=>') ? '=>' : '->'      ;
this.current = checkpoint      ;
if (isFuncType)       {
this.advance()        ;
const params: AST.TypeNode<> = []        ;
if (!this.check(')'))         {
        }this.consume(')', 'Expected \')\' in function type')        ;
this.consume(arrow, `Expected '${/* TODO: undefined */}' in function type`)        ;
const ret = this.parseType()        ;
return { kind: 'FuncType', params, ret, span: this.createSpan(start, this.current - 1) }        ;
      } else       {
this.advance()        ;
const type = this.parseType()        ;
this.consume(')', 'Expected \')\' after parenthesized type')        ;
return type        ;
      }    }let id: AST.Identifier    ;
const token = this.peek()    ;
if (token.type === TokenType.Keyword && token.value === 'void' || token.value === 'undefined' || token.value === 'number' || token.value === 'boolean' || token.value === 'string' || token.value === 'object' || token.value === 'any' || token.value === 'never' || token.value === 'unknown' || token.value === 'null')     {
this.advance()      ;
id = { kind: 'Identifier', name: token.value, span: this.createSpanFrom(token) }      ;
    } else     {
id = this.parseIdentifier()      ;
    }let qualifiedId = id    ;
while (this.match('.'))     {
const member = this.parseIdentifier()      ;
qualifiedId = { kind: 'Identifier', name: `${/* TODO: undefined */}.${/* TODO: undefined */}`, span: this.createSpanFrom(qualifiedId) }      ;
    }if (qualifiedId.name === 'impl' && this.peek().type === TokenType.Identifier)     {
const traitType = this.parseSimpleType()      ;
return { kind: 'ImplType', trait: traitType, span: this.createSpan(start, this.current - 1) }      ;
    }if (qualifiedId.name === 'chan')     {
if (this.check('<'))       {
this.advance()        ;
const elementType = this.parseType()        ;
this.consume('>', 'Expected \'>\' after channel element type')        ;
if (!elementType)         {
throw this.error(this.peek(), 'Failed to parse channel element type')          ;
        }const result = { kind: 'ChanType' as const, direction: 'both' as const, elementType: elementType, span: this.createSpan(start, this.current - 1) }        ;
return result        ;
      } else       {
return { kind: 'ChanType', direction: 'both', elementType: null, span: this.createSpan(start, this.current - 1) }        ;
      }    }if (this.match('<') || this.match('['))     {
const closeBracket = this.previous()?.value === '<' ? '>' : ']'      ;
const args: AST.TypeNode<> = []      ;
if (!this.check(closeBracket))       {
      }this.consume(closeBracket, `Expected '${/* TODO: undefined */}'`)      ;
return { kind: 'GenericType', base: qualifiedId, args, span: this.createSpan(start, this.current - 1) }      ;
    }return { kind: 'SimpleType', id: qualifiedId, span: qualifiedId.span }    ;
  }isType(): boolean   {
const token = this.peek()    ;
return token.type === TokenType.Identifier && token.value === 'any' || token.value === 'never' || token.value === 'bool' || token.value === 'bytes' || token.value === 'string' || token.value === 'char' || token.value === 'bigint' || token.value === 'i8' || token.value === 'i16' || token.value === 'i32' || token.value === 'i64' || token.value === 'u8' || token.value === 'u16' || token.value === 'u32' || token.value === 'u64' || token.value === 'f32' || token.value === 'f64' || token.value === 'chan' || token.type === TokenType.Identifier    ;
  }parseTypeDecl(): AST.TypeDecl   {
const start = this.current - 1    ;
const name = this.parseIdentifier()    ;
let genericParams: AST.Identifier<> | undefined    ;
if (this.match('<'))     {
genericParams = []      ;
this.consume('>', 'Expected \'>\' after generic parameters')      ;
    }this.consume('=', 'Expected \'=\' in type declaration')    ;
const definition = this.parseType()    ;
this.consumeSemicolon()    ;
return { kind: 'TypeDecl', name, genericParams, definition, span: this.createSpan(start, this.current - 1) }    ;
  }parseClassDecl(): AST.ClassDecl   {
const start = this.current - 1    ;
const name = this.parseIdentifier()    ;
let typeParams: AST.Identifier<> | undefined    ;
if (this.match('<'))     {
typeParams = []      ;
this.consume('>', 'Expected \'>\' after type parameters')      ;
    }let extendsType: AST.TypeNode | undefined    ;
if (this.match('extends'))     {
extendsType = this.parseType()      ;
    }let implementsTypes: AST.TypeNode<> | undefined    ;
if (this.match('implements'))     {
implementsTypes = []      ;
    }this.consume('{', 'Expected \'{\' before class body')    ;
const members: AST.ClassMember<> = []    ;
while (!this.check('}') && !this.isAtEnd())     {
while (this.check(';') || this.peek().virtualSemi)       {
this.advance()        ;
      }if (this.check('}'))       {
break        ;
      }try       {
const memberStart = this.current        ;
while (this.check('@'))         {
this.advance()          ;
if (this.peek().type === TokenType.Identifier)           {
this.advance()            ;
if (this.check('('))             {
this.advance()              ;
let depth = 1              ;
while (depth > 0 && !this.isAtEnd())               {
if (this.check('('))                 {
depth++                  ;
                } else                 {
if (this.check(')'))                   {
depth--                    ;
                  }                }this.advance()                ;
              }            }          }while (this.peek().virtualSemi)           {
this.advance()            ;
          }        }if (this.match('def'))         {
const method = this.parseFuncDecl()          ;
members.push(method as any)          ;
continue          ;
        }if (this.match('fn', 'fun', 'function', 'func'))         {
const method = this.parseFuncDecl()          ;
members.push(method as any)          ;
continue          ;
        }if (this.match('async'))         {
if (this.match('fn', 'fun', 'function', 'func', 'def'))           {
const method = this.parseFuncDecl(true)            ;
members.push(method as any)            ;
continue            ;
          }this.current = memberStart          ;
        }if (this.peek().value === 'constructor')         {
const name = this.parseIdentifier()          ;
if (this.check('('))           {
const params = this.parseParameterList()            ;
const body = this.parseBlock()            ;
members.push({ kind: 'Constructor', params, body, span: this.createSpan(memberStart, this.current - 1) } as any)            ;
continue            ;
          }        }let visibility: "public" | "private" | "protected" | undefined        ;
if (this.match('public', 'private', 'protected'))         {
visibility = this.previous()!.value as any          ;
        }let isStatic = false        ;
if (this.match('static'))         {
isStatic = true          ;
        }let isReadonly = false        ;
if (this.match('readonly'))         {
isReadonly = true          ;
        }if (this.peek().type === TokenType.Identifier || this.peek().type === TokenType.Keyword)         {
const nameToken = this.advance()          ;
const name: AST.Identifier = { kind: 'Identifier', name: nameToken.value, span: this.createSpanFrom(nameToken) }          ;
if (this.check('('))           {
const params = this.parseParameterList()            ;
let returnType: AST.TypeNode | undefined            ;
if (this.match(':'))             {
try               {
returnType = this.parseType()                ;
              } catch (error)               {
if (error instanceof ParseError)                 {
this.errors.push(error)                  ;
while (!this.isAtEnd() && !this.check('{') && !this.check('}'))                   {
this.advance()                    ;
                  }                } else                 {
throw error                  ;
                }              }            }let body: AST.Block            ;
try             {
body = this.parseBlock()              ;
            } catch (error)             {
if (error instanceof ParseError)               {
this.errors.push(error)                ;
let depth = 1                ;
while (depth > 0 && !this.isAtEnd())                 {
if (this.peek().value === '{')                   {
depth++                    ;
                  } else                   {
if (this.peek().value === '}')                     {
depth--                      ;
if (depth === 0)                       {
this.advance()                        ;
break                        ;
                      }                    }                  }this.advance()                  ;
                }while (this.check(';') || this.peek().virtualSemi)                 {
this.advance()                  ;
                }body = { kind: 'Block', statements: [], span: this.createSpan(memberStart, this.current - 1) }                ;
              } else               {
throw error                ;
              }            }members.push({ kind: 'Method', name, params, type: returnType, body, span: this.createSpan(memberStart, this.current - 1) } as any)            ;
continue            ;
          }if (this.match(':='))           {
const value = this.parseExpression()            ;
members.push({ kind: 'Field', name, value, span: this.createSpan(memberStart, this.current - 1) } as any)            ;
continue            ;
          }if (this.match(':'))           {
const type = this.parseType()            ;
let value: AST.Expr | undefined            ;
if (this.match('='))             {
value = this.parseExpression()              ;
            }if (this.check('('))             {
while (!this.isAtEnd() && !this.checkSemicolon() && !this.check('}'))               {
this.advance()                ;
              }            } else             {
members.push({ kind: 'Field', name, type, value, span: this.createSpan(memberStart, this.current - 1) } as any)              ;
            }continue            ;
          }if (this.match('='))           {
const value = this.parseExpression()            ;
members.push({ kind: 'Field', name, value, span: this.createSpan(memberStart, this.current - 1) } as any)            ;
continue            ;
          }members.push({ kind: 'Field', name, span: this.createSpan(memberStart, this.current - 1) } as any)          ;
this.consumeSemicolon()          ;
        } else         {
this.advance()          ;
        }      } catch (error)       {
if (error instanceof ParseError)         {
this.errors.push(error)          ;
let braceDepth = 0          ;
while (!this.isAtEnd() && !this.check('}'))           {
const token = this.peek()            ;
if (token.value === '{')             {
braceDepth++              ;
this.advance()              ;
continue              ;
            } else             {
if (token.value === '}' && braceDepth > 0)               {
braceDepth--                ;
this.advance()                ;
continue                ;
              }            }if (braceDepth === 0)             {
if (token.value === 'public' || token.value === 'private' || token.value === 'protected' || token.value === 'static' || token.value === 'readonly' || token.value === 'async' || token.value === 'constructor' || token.value === 'override' || token.value === 'abstract' || token.value === 'get' || token.value === 'set' || token.value === 'declare')               {
break                ;
              }if (token.value === 'private' || token.value === 'public' || token.value === 'protected')               {
const savedPos = this.current                ;
this.advance()                ;
const next = this.peek()                ;
this.current = savedPos                ;
if (next?.type === TokenType.Identifier)                 {
break                  ;
                }              }            }if (this.checkSemicolon() || token.virtualSemi)             {
this.advance()              ;
if (this.peek().type === TokenType.Identifier && !this.isAtEnd())               {
break                ;
              }            } else             {
this.advance()              ;
            }          }        } else         {
throw error          ;
        }      }    }this.consume('}', 'Expected \'}\' after class body')    ;
return { kind: 'ClassDecl', name, typeParams, extends: extendsType, implements: implementsTypes, members, span: this.createSpan(start, this.current - 1) }    ;
  }parseInterfaceDecl(): AST.InterfaceDecl   {
const start = this.current - 1    ;
const name = this.parseIdentifier()    ;
let typeParams: AST.Identifier<> | undefined    ;
if (this.match('<'))     {
typeParams = []      ;
this.consume('>', 'Expected \'>\' after type parameters')      ;
    }let extendsTypes: AST.TypeNode<> | undefined    ;
if (this.match('extends'))     {
extendsTypes = []      ;
    }this.consume('{', 'Expected \'{\' before interface body')    ;
const members: AST.InterfaceMember<> = []    ;
while (!this.check('}') && !this.isAtEnd())     {
this.advance()      ;
    }this.consume('}', 'Expected \'}\' after interface body')    ;
return { kind: 'InterfaceDecl', name, typeParams, extends: extendsTypes, members, span: this.createSpan(start, this.current - 1) }    ;
  }parsePackageDecl(): AST.PackageDecl   {
const start = this.current - 1    ;
const name = this.peek().type === TokenType.Identifier ? this.advance().value : this.consume(TokenType.StringLiteral, 'Expected package name').value    ;
this.consumeSemicolon()    ;
return { kind: 'PackageDecl', name, span: this.createSpan(start, this.current - 1) }    ;
  }parseExportDecl(): AST.ExportDecl   {
const start = this.current - 1    ;
if (this.match('default'))     {
while (!this.check(';') && !this.check('\\n') && !this.isAtEnd())       {
this.advance()        ;
      }this.consumeSemicolon()      ;
return { kind: 'ExportDecl', span: this.createSpan(start, this.current - 1) }      ;
    }if (this.match('type'))     {
if (this.check('{'))       {
const specifiers = this.parseExportSpecifiers()        ;
let source: string | undefined        ;
if (this.match('from'))         {
if (this.peek().type === TokenType.StringLiteral)           {
source = this.advance().value.slice(1, -1)            ;
          }        }this.consumeSemicolon()        ;
return { kind: 'ExportDecl', specifiers, source, span: this.createSpan(start, this.current - 1) }        ;
      } else       {
const declaration = this.parseTypeDecl()        ;
return { kind: 'ExportDecl', declaration, span: this.createSpan(start, this.current - 1) }        ;
      }    }if (this.isDeclStart())     {
const declaration = this.parseDeclaration()      ;
return { kind: 'ExportDecl', declaration, span: this.createSpan(start, this.current - 1) }      ;
    }if (this.check('{'))     {
const specifiers = this.parseExportSpecifiers()      ;
let source: string | undefined      ;
if (this.match('from'))       {
if (this.peek().type === TokenType.StringLiteral)         {
source = this.advance().value.slice(1, -1)          ;
        }      }this.consumeSemicolon()      ;
return { kind: 'ExportDecl', specifiers, source, span: this.createSpan(start, this.current - 1) }      ;
    }if (this.check('*'))     {
this.advance()      ;
if (this.match('from'))       {
let source: string | undefined        ;
if (this.peek().type === TokenType.StringLiteral)         {
source = this.advance().value.slice(1, -1)          ;
        }this.consumeSemicolon()        ;
return { kind: 'ExportDecl', source, span: this.createSpan(start, this.current - 1) }        ;
      }    }if (this.peek().type === TokenType.Identifier)     {
this.advance()      ;
this.consumeSemicolon()      ;
return { kind: 'ExportDecl', span: this.createSpan(start, this.current - 1) }      ;
    }throw this.error(this.peek(), 'Invalid export declaration')    ;
  }parseExportSpecifiers(): AST.ExportSpecifier<>   {
this.consume('{', 'Expected \'{\'')    ;
const specifiers: AST.ExportSpecifier<> = []    ;
if (!this.check('}'))     {
    }this.consume('}', 'Expected \'}\'')    ;
return specifiers    ;
  }parseEnumDecl(): AST.EnumDecl   {
const start = this.current - 1    ;
const name = this.parseIdentifier()    ;
this.consume('{', 'Expected \'{\' before enum body')    ;
const members: AST.EnumMember<> = []    ;
while (!this.check('}') && !this.isAtEnd())     {
while (this.peek().virtualSemi)       {
this.advance()        ;
      }if (this.check('}'))       {
break        ;
      }const memberName = this.parseIdentifier()      ;
let value: AST.Expr | undefined      ;
if (this.match('='))       {
value = this.parseExpression()        ;
      }members.push({ name: memberName, value, span: this.createSpanFrom(memberName) })      ;
while (this.peek().virtualSemi)       {
this.advance()        ;
      }if (!this.match(','))       {
break        ;
      }    }this.consume('}', 'Expected \'}\' after enum body')    ;
return { kind: 'EnumDecl', name, members, span: this.createSpan(start, this.current - 1) }    ;
  }parseNumericLiteral(): AST.NumericLiteral   {
const token = this.advance()    ;
let base: "decimal" | "hex" | "octal" | "binary" = 'decimal'    ;
if (token.value.startsWith('0x') || token.value.startsWith('0X'))     {
base = 'hex'      ;
    } else     {
if (token.value.startsWith('0o') || token.value.startsWith('0O'))       {
base = 'octal'        ;
      } else       {
if (token.value.startsWith('0b') || token.value.startsWith('0B'))         {
base = 'binary'          ;
        }      }    }let suffix: string | undefined    ;
const suffixMatch = token.value.match(/* TODO: RegexLiteral */)    ;
if (suffixMatch)     {
suffix = suffixMatch[0]      ;
    }return { kind: 'NumericLiteral', raw: token.value, base, suffix, span: this.createSpanFrom(token) }    ;
  }parseStringLiteral(): AST.StringLiteral   {
const token = this.advance()    ;
let flags: AST.StringLiteral<"flags"> = {}    ;
let delimiter = token.value[0]    ;
let prefixEnd = 0    ;
for (let i = 0; i < token.value.length; i++)     {
const char = token.value[i]      ;
if (char === 'r')       {
flags.raw = true        ;
      } else       {
if (char === 'b')         {
flags.bytes = true          ;
        } else         {
if (char === 'f')           {
flags.format = true            ;
          } else           {
if (char === 'c')             {
flags.const = true              ;
            } else             {
if (char === '"' || char === '\'' || char === '`')               {
prefixEnd = i                ;
delimiter = char                ;
break                ;
              }            }          }        }      }    }const content = token.value.slice(prefixEnd + 1, -1)    ;
const parts: AST.StringPart<> = []    ;
if (flags.format || delimiter === '`')     {
let current = ''      ;
let i = 0      ;
while (i < content.length)       {
if (flags.format && content[i] === '{' && content[i + 1] !== '{' || delimiter === '`' && content[i] === '$' && content[i + 1] === '{')         {
if (current)           {
parts.push({ kind: 'Text', value: current })            ;
current = ''            ;
          }const start = flags.format ? i + 1 : i + 2          ;
let depth = 1          ;
let end = start          ;
while (end < content.length && depth > 0)           {
if (content[end] === '{')             {
depth++              ;
            } else             {
if (content[end] === '}')               {
depth--                ;
              }            }end++            ;
          }if (depth === 0)           {
const exprStr = content.slice(start, end - 1)            ;
parts.push({ kind: 'Interpolation', value: exprStr })            ;
i = end            ;
          } else           {
current += content[i]            ;
i++            ;
          }        } else         {
if (flags.format && content[i] === '{' && content[i + 1] === '{' || flags.format && content[i] === '}' && content[i + 1] === '}')           {
current += content[i]            ;
i += 2            ;
          } else           {
current += content[i]            ;
i++            ;
          }        }      }if (current)       {
parts.push({ kind: 'Text', value: current })        ;
      }    } else     {
parts.push({ kind: 'Text', value: content })      ;
    }return { kind: 'StringLiteral', parts, flags, delimiter, span: this.createSpanFrom(token) }    ;
  }parseTemplateLiteral(): AST.StringLiteral   {
const token = this.advance()    ;
const content = token.value.slice(1, -1)    ;
const parts: AST.StringPart<> = []    ;
let current = ''    ;
let i = 0    ;
while (i < content.length)     {
if (content[i] === '$' && content[i + 1] === '{')       {
if (current)         {
parts.push({ kind: 'Text', value: current })          ;
current = ''          ;
        }let depth = 1        ;
let end = i + 2        ;
while (end < content.length && depth > 0)         {
if (content[end] === '{')           {
depth++            ;
          } else           {
if (content[end] === '}')             {
depth--              ;
            }          }end++          ;
        }if (depth === 0)         {
const exprStr = content.slice(i + 2, end - 1)          ;
parts.push({ kind: 'Interpolation', value: exprStr })          ;
i = end          ;
        } else         {
current += content[i]          ;
i++          ;
        }      } else       {
if (content[i] === '\\\\' && i + 1 < content.length)         {
i++          ;
switch (content[i]          ) {
case 'n'            :
              {
current += '\\n'                ;
break                ;
              }              break;
case 't'            :
              {
current += '\\t'                ;
break                ;
              }              break;
case 'r'            :
              {
current += '\\r'                ;
break                ;
              }              break;
case '\\\\'            :
              {
current += '\\\\'                ;
break                ;
              }              break;
case '`'            :
              {
current += '`'                ;
break                ;
              }              break;
            default:
              {
current += content[i]                ;
              }          }
i++          ;
        } else         {
current += content[i]          ;
i++          ;
        }      }    }if (current || parts.length === 0)     {
parts.push({ kind: 'Text', value: current })      ;
    }return { kind: 'StringLiteral', parts, flags: { format: true }, delimiter: '`', span: this.createSpanFrom(token) }    ;
  }parseRegexLiteral(): AST.RegexLiteral   {
const token = this.advance()    ;
const lastSlash = token.value.lastIndexOf('/')    ;
const pattern = token.value.slice(1, lastSlash)    ;
const flags = token.value.slice(lastSlash + 1)    ;
return { kind: 'RegexLiteral', pattern, flags, span: this.createSpanFrom(token) }    ;
  }parseListComprehension(expr: AST.Expr, start: number): AST.ArrayLiteral   {
const comprehensions: any<> = []    ;
while (this.match('for'))     {
const variable = this.parseIdentifier()      ;
this.consume('in', 'Expected \'in\' in list comprehension')      ;
const iterable = this.parseExpression()      ;
let condition: AST.Expr | undefined      ;
if (this.match('if'))       {
condition = this.parseExpression()        ;
      }comprehensions.push({ variable, iterable, condition })      ;
if (!this.check('for'))       {
break        ;
      }    }this.consume(']', 'Expected \']\' after list comprehension')    ;
return { kind: 'ArrayLiteral', elements: [expr], span: this.createSpan(start, this.current - 1) }    ;
  }parseArrayLiteral(): AST.ArrayLiteral   {
const start = this.current - 1    ;
const elements: AST.Expr<> = []    ;
if (!this.check(']'))     {
let firstExpr: AST.Expr      ;
if (this.match('...'))       {
const spreadStart = this.current - 1        ;
const optional = this.match('?')        ;
const argument = this.parseAssignmentExpression()        ;
firstExpr = { kind: 'Spread', argument, optional, span: this.createSpan(spreadStart, this.current - 1) }        ;
elements.push(firstExpr)        ;
      } else       {
if (this.check('match'))         {
const checkpoint = this.current          ;
try           {
const matchExpr = this.parseSwitch()            ;
firstExpr = matchExpr as any            ;
          } catch (e)           {
this.current = checkpoint            ;
firstExpr = this.parseAssignmentExpression()            ;
          }        } else         {
firstExpr = this.parseAssignmentExpression()          ;
        }while (this.peek().virtualSemi)         {
this.advance()          ;
        }if (this.check('for'))         {
return this.parseListComprehension(firstExpr, start)          ;
        } else         {
elements.push(firstExpr)          ;
        }      }if (!this.check('for'))       {
while (this.match(','))         {
while (this.peek().virtualSemi)           {
this.advance()            ;
          }if (this.check(']'))           {
break            ;
          }if (this.match('...'))           {
const spreadStart = this.current - 1            ;
const optional = this.match('?')            ;
const argument = this.parseAssignmentExpression()            ;
elements.push({ kind: 'Spread', argument, optional, span: this.createSpan(spreadStart, this.current - 1) })            ;
          } else           {
elements.push(this.parseAssignmentExpression())            ;
          }while (this.peek().virtualSemi)           {
this.advance()            ;
          }        }      }    }while (this.peek().virtualSemi)     {
this.advance()      ;
    }this.consume(']', 'Expected \']\' after array elements')    ;
return { kind: 'ArrayLiteral', elements, span: this.createSpan(start, this.current - 1) }    ;
  }parseObjectLiteral(): AST.ObjectLiteral | AST.SetLiteral   {
const start = this.current - 1    ;
if (!this.check('}'))     {
const checkpoint = this.current      ;
try       {
if (this.peek().type === TokenType.Keyword && this.peekNext()?.value === ':')         {
        } else         {
const firstExpr = this.parseAssignmentExpression()          ;
if (this.check('for'))           {
return this.parseSetComprehension(firstExpr, start)            ;
          }        }      } catch       {
      }this.current = checkpoint      ;
const properties: AST.ObjectProperty<> = []      ;
while (this.peek().virtualSemi)       {
this.advance()        ;
      }this.consume('}', 'Expected \'}\' after object properties')      ;
return { kind: 'ObjectLiteral', properties, span: this.createSpan(start, this.current - 1) }      ;
    }while (this.peek().virtualSemi)     {
this.advance()      ;
    }this.consume('}', 'Expected \'}\' after object properties')    ;
return { kind: 'ObjectLiteral', properties: [], span: this.createSpan(start, this.current - 1) }    ;
  }parseSetComprehension(expr: AST.Expr, start: number): AST.SetLiteral   {
const comprehensions: any<> = []    ;
while (this.match('for'))     {
const variable = this.parseIdentifier()      ;
this.consume('in', 'Expected \'in\' in set comprehension')      ;
const iterable = this.parseExpression()      ;
let condition: AST.Expr | undefined      ;
if (this.match('if'))       {
condition = this.parseExpression()        ;
      }comprehensions.push({ variable, iterable, condition })      ;
if (!this.check('for'))       {
break        ;
      }    }this.consume('}', 'Expected \'}\' after set comprehension')    ;
return { kind: 'SetLiteral', elements: [expr], span: this.createSpan(start, this.current - 1) }    ;
  }parseDictComprehension(firstPair: AST.ObjectLiteral, start: number): AST.ObjectLiteral   {
const comprehensions: any<> = []    ;
while (this.match('for'))     {
const variables: AST.Identifier<> = []      ;
variables.push(this.parseIdentifier())      ;
while (this.match(','))       {
variables.push(this.parseIdentifier())        ;
      }this.consume('in', 'Expected \'in\' in dict comprehension')      ;
const iterable = this.parseExpression()      ;
let condition: AST.Expr | undefined      ;
if (this.match('if'))       {
condition = this.parseExpression()        ;
      }comprehensions.push({ variables, iterable, condition })      ;
if (!this.check('for'))       {
break        ;
      }    }this.consume('}', 'Expected \'}\' after dict comprehension')    ;
return { kind: 'ObjectLiteral', properties: firstPair.properties, span: this.createSpan(start, this.current - 1) }    ;
  }parseGeneratorComprehension(expr: AST.Expr, start: number): AST.Call   {
const comprehensions: any<> = []    ;
while (this.match('for'))     {
const variable = this.parseIdentifier()      ;
this.consume('in', 'Expected \'in\' in generator comprehension')      ;
const iterable = this.parseExpression()      ;
let condition: AST.Expr | undefined      ;
if (this.match('if'))       {
condition = this.parseExpression()        ;
      }comprehensions.push({ variable, iterable, condition })      ;
if (!this.check('for'))       {
break        ;
      }    }this.consume(')', 'Expected \')\' after generator comprehension')    ;
return { kind: 'Call', callee: { kind: 'Identifier', name: '__generator', span: this.createSpan(start, start) }, args: [expr], span: this.createSpan(start, this.current - 1) }    ;
  }parseLambda(): AST.Lambda   {
const start = this.current - 1    ;
let params: AST.Param<> = []    ;
if (!this.check(')'))     {
    }this.consume(')', 'Expected \')\' after lambda parameters')    ;
let returnType: AST.TypeNode | undefined    ;
if (this.match(':'))     {
returnType = this.parseType()      ;
    }this.consume('=>', 'Expected \'=>\' in lambda')    ;
while (this.peek().virtualSemi)     {
this.advance()      ;
    }const body = this.check('{') ? this.parseBlock() : this.parseExpression()    ;
return { kind: 'Lambda', params, returnType, body, span: this.createSpan(start, this.current - 1) }    ;
  }parseAsyncLambda(start: number): AST.Lambda   {
if (this.check('{'))     {
const block = this.parseBlock()      ;
return { kind: 'Lambda', params: [], returnType: null, body: block, async: true, span: this.createSpan(start, this.current - 1) } as AST.Lambda      ;
    }let params: AST.Param<> = []    ;
if (this.match('('))     {
if (!this.check(')'))       {
      }this.consume(')', 'Expected \')\' after lambda parameters')      ;
    } else     {
if (this.peek().type === TokenType.Identifier)       {
const name = this.parseIdentifier()        ;
params.push({ name, type: null, defaultValue: null, span: name.span })        ;
      }    }let returnType: AST.TypeNode | undefined    ;
if (this.match(':'))     {
returnType = this.parseType()      ;
    }this.consume('=>', 'Expected \'=>\' in async lambda')    ;
const body = this.check('{') ? this.parseBlock() : this.parseExpression()    ;
return { kind: 'Lambda', params, returnType, body, async: true, span: this.createSpan(start, this.current - 1) } as AST.Lambda    ;
  }checkLambda(): boolean   {
if (this.check('('))     {
const checkpoint = this.current      ;
this.advance()      ;
let depth = 1      ;
while (depth > 0 && !this.isAtEnd())       {
if (this.check('('))         {
depth++          ;
        }if (this.check(')'))         {
depth--          ;
        }this.advance()        ;
      }const hasArrow = this.check('=>') || this.check(':') && this.peekNext()?.value === '=>'      ;
this.current = checkpoint      ;
return hasArrow      ;
    }if (this.peek().type === TokenType.Identifier)     {
const next = this.peekNext()      ;
return next?.value === '=>' || next?.value === ':' && this.peekAt(2)?.value === '=>'      ;
    }return false    ;
  }checkParenthesizedLambda(): boolean   {
if (this.peek().type === TokenType.Identifier)     {
const next = this.peekNext()      ;
if (next && next.value === ':')       {
let depth = 1        ;
let pos = this.current + 2        ;
while (depth > 0 && pos < this.tokens.length)         {
const tok = this.tokens[pos]          ;
if (tok.value === '(')           {
depth++            ;
          } else           {
if (tok.value === ')')             {
depth--              ;
if (depth === 0)               {
const nextTok = this.tokens[pos + 1]                ;
return nextTok && nextTok.value === '=>'                ;
              }            }          }pos++          ;
        }      }    }let depth = 1    ;
while (depth > 0 && !this.isAtEnd())     {
if (this.check('('))       {
depth++        ;
this.advance()        ;
      } else       {
if (this.check(')'))         {
depth--          ;
this.advance()          ;
        } else         {
this.advance()          ;
        }      }    }return this.check('=>') || this.check(':') && this.peekNext()?.value === '=>'    ;
  }parseNewExpression(): AST.Call   {
const start = this.current - 1    ;
const callee = this.parsePrimary()    ;
let args: AST.Expr<> = []    ;
if (this.match('('))     {
args = this.parseArguments()      ;
this.must(')', { recoverWithSynthetic: true })      ;
    }return { kind: 'Call', callee: { kind: 'Member', object: { kind: 'Identifier', name: 'new', span: this.createSpan(start, start) }, property: callee as AST.Identifier, span: this.createSpanFrom(callee) }, args, span: this.createSpan(start, this.current - 1) }    ;
  }typeNodeToString(type: AST.TypeNode): string   {
switch (type.kind    ) {
case 'SimpleType'      :
        {
return type.id.name          ;
        }        break;
case 'ChanType'      :
        {
const prefix = type.direction === 'receive' ? '<-chan' : type.direction === 'send' ? 'chan<-' : 'chan'          ;
return type.elementType ? `${/* TODO: undefined */} ${/* TODO: undefined */}` : prefix          ;
        }        break;
case 'NullableType'      :
        {
return `${/* TODO: undefined */}?`          ;
        }        break;
case 'UnionType'      :
        {
return type.types.map(t => this.typeNodeToString(t)).join(' | ')          ;
        }        break;
case 'GenericType'      :
        {
return `${/* TODO: undefined */}<${/* TODO: undefined */}>`          ;
        }        break;
case 'FuncType'      :
        {
return `(${/* TODO: undefined */}) => ${/* TODO: undefined */}`          ;
        }        break;
      default:
        {
return 'unknown'          ;
        }    }
  }parseIdentifier(): AST.Identifier   {
const token = this.peek()    ;
if (token.type === TokenType.Keyword && this.shouldReinterpretAsIdentifier())     {
this.advance()      ;
return { kind: 'Identifier', name: token.value, originalSpelling: token.value, span: this.createSpanFrom(token) }      ;
    }if (token.type === TokenType.Identifier || token.type === TokenType.SigilIdentifier)     {
this.advance()      ;
const name = token.type === TokenType.SigilIdentifier ? token.value.slice(1) : token.value      ;
return { kind: 'Identifier', name, originalSpelling: token.value, span: this.createSpanFrom(token) }      ;
    }if (token.type === TokenType.TemplateLiteral && this.shouldReinterpretAsIdentifier())     {
return this.parseBacktickIdentifier()      ;
    }this.errors.push(new.undefined())    ;
return this.createMissingIdentifier()    ;
  }shouldReinterpretAsIdentifier(): boolean   {
const prev = this.previous()    ;
if (!prev)     {
return false      ;
    }if (prev.value === 'def' || prev.value === 'fun' || prev.value === 'fn' || prev.value === 'function' || prev.value === 'class' || prev.value === 'struct' || prev.value === 'interface' || prev.value === 'trait' || prev.value === 'type' || prev.value === 'enum' || prev.value === 'let' || prev.value === 'var' || prev.value === 'const' || prev.value === 'auto' || prev.value === 'final' || prev.value === 'immutable')     {
return true      ;
    }if (prev.value === 'import' || prev.value === 'as' || prev.value === 'export')     {
return true      ;
    }if (prev.value === '.' || prev.value === '?.')     {
return true      ;
    }if (prev.value === '{' || prev.value === ',')     {
return true      ;
    }return false    ;
  }parseBacktickIdentifier(): AST.Identifier   {
const token = this.advance()    ;
if (token.value.includes('${'))     {
this.current--      ;
return this.parseTemplateLiteral() as any      ;
    }const content = token.value.slice(1, -1)    ;
if (!/* TODO: RegexLiteral */.test(content))     {
this.current--      ;
return this.parseTemplateLiteral() as any      ;
    }return { kind: 'Identifier', name: content, originalSpelling: token.value, span: this.createSpanFrom(token) }    ;
  }parseIdentifierList(): AST.Identifier<>   {
const ids: AST.Identifier<> = [this.parseIdentifier()]    ;
while (this.match(','))     {
ids.push(this.parseIdentifier())      ;
    }return ids    ;
  }parseExpressionList(): AST.Expr<>   {
const exprs: AST.Expr<> = [this.parseAssignmentExpression()]    ;
while (this.match(','))     {
exprs.push(this.parseAssignmentExpression())      ;
    }return exprs    ;
  }parseArguments(): AST.Expr<>   {
const args: AST.Expr<> = []    ;
while (this.peek().virtualSemi)     {
this.advance()      ;
    }if (!this.check(')'))     {
    }return args    ;
  }parseAssignmentExpression(): AST.Expr   {
return this.parseExpression(this.getPrecedence({ value: ',' } as Token) + 1)    ;
  }tryParseGenericArgs(): AST.TypeNode<> | null   {
if (!this.check('<'))     {
return null      ;
    }const checkpoint = this.current    ;
try     {
this.advance()      ;
const args: AST.TypeNode<> = []      ;
if (this.check('>>'))       {
const token = this.peek()        ;
token.value = '>'        ;
      } else       {
if (this.check('>>>'))         {
const token = this.peek()          ;
token.value = '>'          ;
        } else         {
this.consume('>', 'Expected \'>\' after generic arguments')          ;
        }      }const next = this.peek()      ;
if (next.value === '(' || next.value === '[' || next.value === '{' || next.value === '>' || next.value === '>>' || next.value === '>>>' || next.value === ':' || next.value === 'extends' || next.value === 'implements' || next.value === 'where')       {
return args        ;
      }this.current = checkpoint      ;
return null      ;
    } catch     {
this.current = checkpoint      ;
return null      ;
    }  }getPrecedence(token: Token): number   {
switch (token.value    ) {
case '**'      :
        {
return 15          ;
        }        break;
case '*'      :
        {
        }        break;
case '/'      :
        {
        }        break;
case '%'      :
        {
return 14          ;
        }        break;
case '+'      :
        {
        }        break;
case '-'      :
        {
return 13          ;
        }        break;
case '<<'      :
        {
        }        break;
case '>>'      :
        {
        }        break;
case '>>>'      :
        {
return 12          ;
        }        break;
case '..'      :
        {
return 11.5          ;
        }        break;
case '<-'      :
        {
return 11.3          ;
        }        break;
case '<'      :
        {
        }        break;
case '<='      :
        {
        }        break;
case '>'      :
        {
        }        break;
case '>='      :
        {
        }        break;
case 'in'      :
        {
        }        break;
case 'instanceof'      :
        {
return 11          ;
        }        break;
case '<=>'      :
        {
return 11          ;
        }        break;
case '=='      :
        {
        }        break;
case '!='      :
        {
        }        break;
case '==='      :
        {
        }        break;
case '!=='      :
        {
return 10          ;
        }        break;
case '=~'      :
        {
return 10          ;
        }        break;
case '|>'      :
        {
return 9          ;
        }        break;
case '&'      :
        {
return 9          ;
        }        break;
case '^'      :
        {
return 8          ;
        }        break;
case '|'      :
        {
return 7          ;
        }        break;
case '&&'      :
        {
return 6          ;
        }        break;
case '||'      :
        {
return 5          ;
        }        break;
case '??'      :
        {
return 4          ;
        }        break;
case '?'      :
        {
return 3          ;
        }        break;
case '='      :
        {
        }        break;
case '+='      :
        {
        }        break;
case '-='      :
        {
        }        break;
case '*='      :
        {
        }        break;
case '/='      :
        {
        }        break;
case '%='      :
        {
        }        break;
case '**='      :
        {
        }        break;
case '<<='      :
        {
        }        break;
case '>>='      :
        {
        }        break;
case '>>>='      :
        {
        }        break;
case '&='      :
        {
        }        break;
case '^='      :
        {
        }        break;
case '|='      :
        {
        }        break;
case '??='      :
        {
        }        break;
case ':='      :
        {
        }        break;
case ':=:'      :
        {
return 2          ;
        }        break;
case ','      :
        {
return 1          ;
        }        break;
      default:
        {
return 0          ;
        }    }
  }isRightAssociative(token: Token): boolean   {
return token.value === '**' || this.isAssignmentOp(token)    ;
  }isBinaryOp(token: Token): boolean   {
return this.getPrecedence(token) > 0 && !this.isAssignmentOp(token)    ;
  }isAssignmentOp(token: Token): boolean   {
const op = token.value    ;
return op === '=' || op === '+=' || op === '-=' || op === '*=' || op === '/=' || op === '%=' || op === '**=' || op === '<<=' || op === '>>=' || op === '>>>=' || op === '&=' || op === '^=' || op === '|=' || op === '??=' || op === ':=' || op === ':=:'    ;
  }isUnaryOp(token: Token): boolean   {
const op = token.value    ;
return op === '!' || op === '~' || op === '+' || op === '-' || op === 'typeof' || op === 'void' || op === 'delete' || op === 'await' || op === '++' || op === '--' || op === '&' || op === '*'    ;
  }consumeDirectives(): void   {
while (this.peek().type === TokenType.Comment)     {
const comment = this.advance()      ;
if (comment.value.startsWith('// @generics'))       {
this.nextStmtGenericMode = 'on'        ;
      } else       {
if (comment.value.startsWith('// @nogenerics'))         {
this.nextStmtGenericMode = 'off'          ;
        }      }    }  }consumeSemicolon(): void   {
if (this.match(';') || this.peek().virtualSemi)     {
if (this.peek().virtualSemi)       {
return        ;
      }    }  }checkSemicolon(): boolean   {
return this.check(';') || this.peek().virtualSemi || false    ;
  }skipSemicolons(): void   {
while (this.check(';') || this.peek().virtualSemi)     {
this.advance()      ;
    }  }synchronize(): void   {
this.advance()    ;
while (!this.isAtEnd())     {
if (this.previous()?.type === TokenType.Operator && this.previous()?.value === ';')       {
return        ;
      }const token = this.peek()      ;
if (token.value === 'fi' || token.value === 'esac' || token.value === 'done' || token.value === 'end' || token.value === '}' || token.value === 'elif' || token.value === 'else' || token.value === 'elseif' || token.value === 'rescue' || token.value === 'ensure' || token.value === 'except' || token.value === 'finally')       {
return        ;
      }if (this.isDeclStart())       {
return        ;
      }this.advance()      ;
    }  }error(token: Token, message: string): ParseError   {
return new.undefined()    ;
  }createSpan(start: number, end: number): AST.Span   {
const startToken = this.tokens[start] || this.tokens[0]    ;
const endToken = this.tokens[end] || this.tokens[this.tokens.length - 1]    ;
return { start: startToken.start, end: endToken.end, line: startToken.line, column: startToken.column }    ;
  }createSpanFrom(node: object | Token): AST.Span   {
if ('span' in node)     {
return { ...: ...node.span, end: this.previous()?.end || node.span.end }      ;
    }return { start: node.start, end: node.end, line: node.line, column: node.column }    ;
  }peek(): Token   {
if (this.isAtEnd())     {
return this.tokens[this.tokens.length - 1]      ;
    }return this.tokens[this.current]    ;
  }peekNext(): Token | undefined   {
return this.tokens[this.current + 1]    ;
  }peekAt(offset: number): Token | undefined   {
return this.tokens[this.current + offset]    ;
  }previous(): Token | undefined   {
return this.tokens[this.current - 1]    ;
  }advance(): Token   {
if (!this.isAtEnd())     {
this.current++      ;
    }return this.previous()!    ;
  }isAtEnd(): boolean   {
if (this.current >= this.tokens.length)     {
return true      ;
    }const token = this.tokens[this.current]    ;
return token && token.type === TokenType.EOF    ;
  }check(value: string): boolean   {
if (this.isAtEnd())     {
return false      ;
    }return this.peek().value === value    ;
  }match(values: string<>): boolean   {
for (const value of values)     {
if (this.check(value))       {
this.advance()        ;
return true        ;
      }    }return false    ;
  }consume(expected: TokenType | string, message: string): Token   {
const token = this.peek()    ;
if (typeofexpected === 'string')     {
if (token.value === expected)       {
return this.advance()        ;
      }    } else     {
if (token.type === expected)       {
return this.advance()        ;
      }    }throw this.error(token, message)    ;
  }}
