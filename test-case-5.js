
const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

const code = `
# State machine mixing TypeScript types and pattern matching
type State = "idle" | "loading" | "success" | "error"
type Event = {type: "FETCH"} | {type: "SUCCESS", data: any} | {type: "ERROR", error: Error}

class StateMachine<S, E> {
  state: S
  transitions: Map
  
  constructor(initial: S) {
    this.state = initial
    this.transitions = new Map()
  }
  
  # Define transitions with pattern matching
  def on(fromState: S, event: E["type"], toState: S, action?: Function) {
    key := \`\${fromState}:\${event}\`
    this.transitions.set(key, {toState, action})
    return this
  }
  
  # Process event with mixed error handling
  async send(event: E) {
    key := \`\${this.state}:\${event.type}\`
    transition := this.transitions.get(key)
    
    if transition == nil {
      echo "No transition for $key"
      return
    }
    
    try:
      if transition.action:
        await transition.action(event)
      
      oldState := this.state
      this.state = transition.toState
      
      # Emit state change event
      this.emit("stateChange", {
        from: oldState,
        to: this.state,
        event: event
      })
    except Exception as e:
      this.state = "error"
      raise e
    finally:
      this.logTransition()
  }
  
  # Guard conditions with mixed syntax
  fn canTransition(event: E) -> bool {
    key := \`\${this.state}:\${event.type}\`
    
    # Bash-style existence check
    if [ -n "\${this.transitions.get(key)}" ]; then
      return true
    fi
    
    return false
  }
}

# Create and configure state machine
machine := new StateMachine<State, Event>("idle")
  .on("idle", "FETCH", "loading", async () => {
    echo "Starting fetch..."
  })
  .on("loading", "SUCCESS", "success", (event) => {
    console.log("Data received:", event.data)
  })
  .on("loading", "ERROR", "error", (event) => {
    console.error("Error occurred:", event.error)
  })

# Use the state machine
go async () => {
  await machine.send({type: "FETCH"})
  
  try {
    data := await fetchData()
    await machine.send({type: "SUCCESS", data})
  } catch (error) {
    await machine.send({type: "ERROR", error})
  }
}()
`;

console.log('Testing: parses state machine with mixed paradigms');
console.log('Code length:', code.length);

const timeout = setTimeout(() => {
  console.log('TIMEOUT - Parser stuck!');
  process.exit(1);
}, 2000);

try {
  const lexer = new Lexer(code);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens);
  const ast = parser.parse();
  clearTimeout(timeout);
  
  console.log(`Success! AST body length: ${ast.body.length}`);
} catch (e) {
  clearTimeout(timeout);
  console.log('Parse error:', e.message);
}
