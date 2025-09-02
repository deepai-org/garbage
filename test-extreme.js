const { quickTest, findFailurePoint } = require('./debug-utils');

const code = `function outer() {
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
}`;

console.log('Testing extreme nesting...\n');
const result = quickTest(code, { showTokens: false, showAst: false });

if (result.errors.length > 0) {
  console.log('\nFinding failure point...');
  findFailurePoint(code);
}