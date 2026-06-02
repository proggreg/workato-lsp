const { spawn } = require('child_process');
const path = require('path');

const serverPath = path.join(__dirname, 'out', 'server.js');

console.log('🐛 DEBUG: Go to Definition');
console.log('========================');

const lsp = spawn('node', [serverPath, '--stdio'], {
  stdio: ['pipe', 'pipe', 'pipe'] // Changed to capture stderr too
});

// Simple test case
const connector = `{
  title: "Debug Test",
  
  actions: {
    test_action: {
      execute: lambda do |input, connection|
        call(:my_method)
        object_definitions["user"]
        input["test_field"]
      end
    }
  },
  
  object_definitions: {
    user: {
      fields: lambda do
        [{ name: "id", type: "integer" }]
      end
    }
  },
  
  methods: {
    my_method: lambda do
      "hello"
    end
  }
}`;

const lines = connector.split('\n');
console.log('Lines with potential references:');
lines.forEach((line, i) => {
  if (line.includes('call(') || line.includes('object_definitions') || line.includes('input[')) {
    console.log(`  ${i}: ${line.trim()}`);
  }
});

function sendMessage(message) {
  const content = JSON.stringify(message);
  const header = `Content-Length: ${content.length}\r\n\r\n`;
  console.log('\n📤 SENDING:', message.method, message.id ? `(id: ${message.id})` : '');
  lsp.stdin.write(header + content);
}

const testCases = [
  { line: 6, char: 14, desc: 'call(:my_method) - on "my_method"' },
  { line: 7, char: 25, desc: 'object_definitions["user"] - on "user"' },
  { line: 8, char: 15, desc: 'input["test_field"] - on "test_field"' }
];

let currentTest = 0;

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
        uri: 'file:///debug/connector.rb',
        languageId: 'ruby',
        version: 1,
        text: connector
      }
    }
  }
];

// Add test definition requests
testCases.forEach((test, i) => {
  messages.push({
    jsonrpc: '2.0',
    id: i + 10,
    method: 'textDocument/definition',
    params: {
      textDocument: { uri: 'file:///debug/connector.rb' },
      position: { line: test.line, character: test.char }
    }
  });
});

let messageIndex = 0;

function sendNext() {
  if (messageIndex < messages.length) {
    const message = messages[messageIndex];
    
    // Add test case info for definition requests
    if (message.method === 'textDocument/definition') {
      const testIndex = message.id - 10;
      const test = testCases[testIndex];
      console.log(`\n🎯 TEST ${testIndex + 1}: ${test.desc}`);
      console.log(`   Position: line ${test.line}, char ${test.char}`);
      console.log(`   Line content: "${lines[test.line].trim()}"`);
    }
    
    sendMessage(message);
    messageIndex++;
    setTimeout(sendNext, 300);
  } else {
    console.log('\n⏳ All messages sent, waiting for responses...');
    setTimeout(() => {
      console.log('🔚 Ending debug session');
      lsp.kill();
    }, 3000);
  }
}

// Capture all output
lsp.stdout.on('data', (data) => {
  const str = data.toString();
  console.log('\n📥 STDOUT:', str.replace(/\r\n/g, '\\r\\n'));
});

lsp.stderr.on('data', (data) => {
  const str = data.toString();
  console.log('\n🔍 STDERR (Debug logs):', str);
});

lsp.on('close', (code) => {
  console.log(`\n✅ LSP process exited with code ${code}`);
});

lsp.on('error', (err) => {
  console.error('\n❌ LSP process error:', err);
});

setTimeout(sendNext, 100);