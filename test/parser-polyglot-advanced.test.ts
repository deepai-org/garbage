import { describe, test, expect } from '@jest/globals';
import { Parser } from '../src/parser';
import { Lexer } from '../src/lexer';
import * as AST from '../src/ast';

function parseCode(code: string): AST.Program {
  const lexer = new Lexer(code);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens);
  return parser.parse();
}

describe('Advanced Polyglot Parser Tests', () => {
  test('parses extreme operator mixing and chaining', () => {
    const code = `
# Mixing all operator styles
result := x ?? y || z && w <=> v << 2 >> 1 >>> 3
chan := make(<-chan int)
value := <-chan ?? throw new Error("no value")
ptr := &obj.*.field?.[index]
spread := [...arr1, ...arr2, ...?optionalArr]
pipeline := data |> filter |> map |> reduce
range := 1..10
destructured := {x, y, ...rest} = obj
`;

    const ast = parseCode(code);
    expect(ast.body.length).toBeGreaterThanOrEqual(8);
  });

  test('parses nested mixed-language blocks', () => {
    const code = `
# Python function with Go defer and Ruby blocks
def complexFunc(data):
  defer cleanup()
  
  begin
    if data.valid:
      case data.type in
        "json")
          with open(file) as f:
            loop {
              line := f.readline()
              break if !line
              yield line.strip()
            }
          ;;
        "xml")
          foreach node in data.nodes do
            defer node.close()
            try {
              process(node)
            } catch (e) {
              echo "Error: $e"
            } finally {
              log("processed")
            }
          done
          ;;
      esac
    else:
      raise ValueError("Invalid data")
  rescue => e
    console.error(e)
  ensure
    finalize()
  end
`;

    const ast = parseCode(code);
    expect(ast.body.length).toBeGreaterThanOrEqual(1);
    const funcDecl = ast.body[0] as AST.FuncDecl;
    expect(funcDecl.kind).toBe('FuncDecl');
  });

  test('parses mixed async/concurrent patterns', () => {
    const code = `
# Mixing async/await, goroutines, and channels
async fn processStream<T>(input: Stream<T>) -> Result<Vec<T>, Error> {
  results := []
  ch := make(chan T, 100)
  
  // Spawn multiple workers
  for i := 0; i < 10; i++ {
    go async () => {
      while item := <-ch {
        processed := await transform(item)
        results.push(processed)
      }
    }()
  }
  
  // Feed the channel
  async for await (const item of input) {
    select {
      case ch <- item:
        continue
      default:
        await sleep(100ms)
    }
  }
  
  return Ok(results)
}
`;

    const ast = parseCode(code);
    expect(ast.body.length).toBeGreaterThanOrEqual(1);
  });

  test('parses complex pattern matching across languages', () => {
    const code = `
# Pattern matching fusion
match value {
  Some(x) if x > 0 => {
    case x in
      1..10)
        echo "small"
        ;;
      11..100)
        echo "medium"
        ;;
      *)
        echo "large"
        ;;
    esac
  },
  None | null | undefined => console.log("empty"),
  [head, ...tail] => process(head, tail),
  {type: "user", name, age} if age >= 18 => authorize(name),
  _ => throw new Error("unmatched")
}
`;

    const ast = parseCode(code);
    expect(ast.body.length).toBeGreaterThanOrEqual(1);
  });

  test('parses mixed class and trait definitions', () => {
    const code = `
# Classes with mixed syntax
interface AsyncIterator<T> extends Iterable {
  async next(): Promise<{value: T, done: bool}>
}

trait Drawable {
  fn draw(&self)
  def render(self, canvas): pass
}

class Shape implements Drawable with Colorable {
  constructor(public x: number, public y: number) {
    super()
    this.id := generateId()
  }
  
  async def update(self, delta):
    defer self.cleanup()
    with self.lock:
      self.x += delta.x ?? 0
      self.y += delta.y ?? 0
  
  override fn draw(&self) {
    echo "Drawing at ($self.x, $self.y)"
  }
}
`;

    const ast = parseCode(code);
    expect(ast.body.length).toBeGreaterThanOrEqual(3);
  });

  test('parses extreme nesting with mixed syntax', () => {
    const code = `
# Deep nesting across paradigms
function outer() {
  def middle():
    fn inner() -> impl Future {
      async {
        loop {
          for i in 0..10 {
            while true do
              if [ $i -gt 5 ]; then
                case $i in
                  6)
                    begin
                      try:
                        with context:
                          using resource {
                            defer cleanup()
                            yield i
                          }
                      except:
                        pass
                      finally:
                        break
                    end
                    ;;
                  *)
                    continue
                    ;;
                esac
              fi
            done
          }
        }
      }
    }
    return inner
  return middle()
}
`;

    const ast = parseCode(code);
    expect(ast.body.length).toBeGreaterThanOrEqual(1);
  });

  test('parses mixed string interpolation and templates', () => {
    const code = `
# Every string style
s1 := "basic string"
s2 := 'single quotes'
s3 := \`template \${with} interpolation\`
s4 := f"Python f-string {value}"
s5 := r"raw\\nstring"
s6 := b"byte string"
s7 := """
  multiline
  string
"""
s8 := '''another
multiline'''
s9 := $"C# interpolated {expr}"
s10 := @"verbatim string"
s11 := <<EOF
heredoc content
with $variables
EOF
`;

    const ast = parseCode(code);
    expect(ast.body.length).toBeGreaterThanOrEqual(11);
  });

  test('parses mixed type systems and generics', () => {
    const code = `
# Type annotation chaos
type Result<T, E> = Ok<T> | Err<E>
type Maybe<T> = Some(T) | None
interface Functor<F> {
  map<A, B>(f: (a: A) -> B, fa: F<A>): F<B>
}

fn curry<A, B, C>(f: (A, B) -> C) -> A -> B -> C {
  return a => b => f(a, b)
}

async def generic_func[T: Display + Send](
  x: T,
  y: impl Iterator<Item=T>
) -> Result[List[T], str]:
  result: Vec<T> = []
  async for item in y:
    result.push(item)
  return Ok(result)

const typed: {
  readonly [K in keyof T as \`get\${Capitalize<K>}\`]: () => T[K]
} & {
  set<K extends keyof T>(key: K, value: T[K]): void
} = createAccessors()
`;

    const ast = parseCode(code);
    expect(ast.body.length).toBeGreaterThanOrEqual(5);
  });

  test('parses mixed comprehensions and generators', () => {
    const code = `
# Comprehension fusion
list1 := [x * 2 for x in range(10) if x % 2 == 0]
set1 := {x for x in items if x.valid}
dict1 := {k: v for k, v in pairs}
gen1 := (x * x for x in numbers)

# Generator functions
function* jsGenerator() {
  yield* otherGen()
  yield 42
}

def pyGenerator():
  yield from another_gen()
  return result

# Async generators
async function* asyncGen() {
  for await (const item of stream) {
    if item.ready:
      yield item.value
  }
}

# Mixed comprehension with pattern matching
result := [
  match x {
    Some(v) if v > 0 => v * 2,
    None => 0,
    _ => -1
  }
  for x in maybeValues
  if x !== undefined
]
`;

    const ast = parseCode(code);
    expect(ast.body.length).toBeGreaterThanOrEqual(8);
  });

  test('parses mixed error handling paradigms', () => {
    const code = `
# Error handling fusion
fn risky() -> Result<i32, Error> {
  try {
    value := dangerous_op()?
    
    # Bash-style error check
    if [ $? -ne 0 ]; then
      return Err("Command failed")
    fi
    
    # Go-style error handling
    result, err := another_op()
    if err != nil {
      return Err(err)
    }
    
    # Python-style
    try:
      processed = process(result)
    except ValueError as e:
      raise ChainedError(e)
    else:
      log("success")
    finally:
      cleanup()
    
    # Ruby-style
    begin
      finalize(processed)
    rescue StandardError => e
      retry if retries < 3
    ensure
      close_resources()
    end
    
    # Rust-style
    let final = match processed {
      Ok(v) => v,
      Err(e) => return Err(e.into())
    }
    
    Ok(final)
  } catch (e) {
    Err(e)
  }
}
`;

    const ast = parseCode(code);
    expect(ast.body.length).toBeGreaterThanOrEqual(1);
  });

  test('parses mixed module and import systems', () => {
    const code = `
# Import/module chaos
import std.stdio
from typing import List, Dict, Optional
import { Component, useState } from 'react'
use std::collections::HashMap
require 'json'
include Math
using System.Linq
package main

# Module definitions
module MyModule {
  export interface Config {
    timeout: number
  }
  
  pub fn setup(config: Config) {
    // implementation
  }
  
  export default class Manager {
    static {
      console.log("Static init")
    }
  }
}

# Namespace
namespace Company.Product {
  export type Settings = Config & {
    advanced: boolean
  }
}
`;

    const ast = parseCode(code);
    expect(ast.body.length).toBeGreaterThanOrEqual(8);
  });

  test('parses mixed decorators and attributes', () => {
    const code = `
# Decorator madness
@deprecated("Use newFunc instead")
@memoize
@log_calls
@inject(Database)
#[derive(Debug, Clone)]
#[cfg(feature = "advanced")]
[<EntryPoint>]
[[nodiscard]]
@Override
async def decorated_func(
  @NotNull param1: str,
  @Range(min=0, max=100) param2: int
) -> @Future[Result[str, Error]]:
  pass

@Component({
  selector: 'app-root',
  template: \`<div>{{title}}</div>\`
})
class AppComponent {
  @Input() title: string
  @Output() clicked = new EventEmitter()
  
  @HostListener('click')
  onClick() {
    this.clicked.emit()
  }
}
`;

    const ast = parseCode(code);
    expect(ast.body.length).toBeGreaterThanOrEqual(2);
  });

  test('parses polyglot DSL with mixed syntax', () => {
    const code = `
# DSL mixing multiple language features
pipeline "data-processor" {
  stage('extract') {
    from source: 's3://bucket/data/*.json'
    where created_at > '2024-01-01'
    limit 1000
  }
  
  stage('transform') |> async (data) => {
    data
      |> filter(x => x.valid)
      |> map(x => {
        ...x,
        processed: true,
        timestamp: Date.now()
      })
      |> reduce((acc, x) => [...acc, x], [])
  }
  
  stage('load') {
    to sink: 'postgres://db/table'
    on_conflict: 'update'
    batch_size: 100
  }
  
  on_error {
    retry times: 3, delay: '5s'
    then {
      notify slack: '#alerts'
      log level: 'error'
    }
  }
}
`;

    const ast = parseCode(code);
    expect(ast.body.length).toBeGreaterThanOrEqual(1);
  });

  test('parses mixed macro and metaprogramming', () => {
    const code = `
# Macro mixing
macro_rules! define_ops {
  ($($op:tt)*) => {
    fn $op(a: i32, b: i32) -> i32 {
      a $op b
    }
  }
}

defmacro when(condition, body) do
  quote do
    if unquote(condition) do
      unquote(body)
    end
  end
end

# Template metaprogramming
template<typename T>
concept Numeric = requires(T a, T b) {
  { a + b } -> std::same_as<T>
  { a * b } -> std::same_as<T>
}

# Compile-time evaluation
const COMPILE_TIME := comptime {
  let mut result = 0
  for i in 0..100 {
    result += i
  }
  result
}

# Code generation
@generate
def create_getters(fields: List[str]) {
  for field in fields:
    yield f"def get_{field}(self): return self.{field}"
}
`;

    const ast = parseCode(code);
    expect(ast.body.length).toBeGreaterThanOrEqual(4);
  });

  test('parses chained operations across paradigms', () => {
    const code = `
# Ultimate chaining test
result := await fetch(url)
  ?.json()
  |> validate
  |> async (data) => {
    data.items
      .filter(x => x?.active ?? false)
      .map(x => x.transform())
      .flatMap(x => x.nested)
      .reduce((acc, x) => acc + x, 0)
  }()
  |> Result.mapError(e => new Error(\`Failed: \${e}\`))
  |> match {
    Ok(value) => value * 2,
    Err(e) => throw e
  }
  ?? defaultValue
  || computeFallback()
  
# Method chaining with mixed syntax
obj
  .method1()
  ?.method2()
  !.method3()  # Force unwrap
  ->method4()   # Pointer access
  ::method5()   # Static access
  ..method6()   # Cascade
  .?method7()   # Safe navigation
  |> finalTransform
`;

    const ast = parseCode(code);
    expect(ast.body.length).toBeGreaterThanOrEqual(2);
  });
});