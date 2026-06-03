const { spawn } = require('child_process');
const path = require('path');

const serverPath = path.join(__dirname, 'out', 'server.js');

console.log('Testing Precise Definition...');

const lsp = spawn('node', [serverPath, '--stdio'], {
  stdio: ['pipe', 'pipe', 'inherit']
});

const connector = `{
  title: "Test",
  
  actions: {
    test: {
      execute: lambda do
        call(:my_method)
      end
    }
  },
  
  methods: {
    my_method: lambda do
      "test"
    end
  }
}`;

const lines = connector.split('\n');
console.log('Line breakdown:');
lines.forEach((line, i) => {
  console.log(`${i.toString().padStart(2, ' ')}: ${line}`);
});

function sendMessage(message) {
  const content = JSON.stringify(message);
  const header = `Content-Length: ${content.length}\r\n\r\n`;
  lsp.stdin.write(header + content);
}

const messages = [
  {
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: { processId: process.pid, capabilities: { textDocument: { definition: {} } } }
  },
  { jsonrpc: '2.0', method: 'initialized', params: {} },
  {
    jsonrpc: '2.0',
    method: 'textDocument/didOpen',
    params: {
      textDocument: {
        uri: 'file:///test/connector.rb',
        languageId: 'ruby',
        version: 1,
        text: connector
      }
    }
  },
  {
    jsonrpc: '2.0',
    id: 2,
    method: 'textDocument/definition',
    params: {
      textDocument: { uri: 'file:///test/connector.rb' },
      position: { line: 6, character: 14 } // On "my_method" in call(:my_method)
    }
  }
];

let messageIndex = 0;
function sendNext() {
  if (messageIndex < messages.length) {
    console.log(`\nSending: ${messages[messageIndex].method}`);
    if (messages[messageIndex].id === 2) {
      console.log('Position:', JSON.stringify(messages[messageIndex].params.position));
      console.log('Target line:', `"${lines[messages[messageIndex].params.position.line]}"`);
      console.log('Character at position:', `"${lines[messages[messageIndex].params.position.line][messages[messageIndex].params.position.character]}"`);
    }
    sendMessage(messages[messageIndex]);
    messageIndex++;
    setTimeout(sendNext, 200);
  } else {
    setTimeout(() => lsp.kill(), 2000);
  }
}

lsp.stdout.on('data', (data) => {
  const str = data.toString();
  const lines = str.split('\r\n');
  
  for (const line of lines) {
    if (line.trim() && !line.startsWith('Content-Length:')) {
      try {
        const json = JSON.parse(line);
        if (json.method === 'textDocument/publishDiagnostics') {
          console.log('Diagnostics:', json.params.diagnostics.length, 'issues');
        } else if (json.id === 2) {
          console.log('\n🎯 DEFINITION RESULT:');
          if (json.result) {
            console.log('✅ Found definition at:');
            console.log('  Line:', json.result.range.start.line);
            console.log('  Character:', json.result.range.start.character);
            console.log('  Expected line 12 with "my_method: lambda"');
          } else {
            console.log('❌ No definition found');
          }
        }
      } catch (e) {
        if (line.includes('result')) console.log('Parse error on:', line);
      }
    }
  }
});

lsp.on('close', () => console.log('\nTest completed'));

setTimeout(sendNext, 100);