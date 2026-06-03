// This file runs the LSP server and sends test messages for debugging in VS Code
const { spawn } = require('child_process');
const path = require('path');

const serverPath = path.join(__dirname, 'out', 'server.js');

console.log('🐛 Debug LSP Server with Test Messages');
console.log('Set breakpoints in src/workatoDefinition.ts and press F5 in VS Code!');
console.log('=====================================');

// Simple connector for testing
const connector = `{
  title: "Debug Test",
  
  actions: {
    test: {
      execute: lambda do |input, connection|
        call(:my_method)
        result = object_definitions["user"]
        field = input["test_field"]
        result
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
      puts "Hello from my_method"
      "success"
    end
  }
}`;

// Start server
const lsp = spawn('node', [serverPath, '--stdio'], {
  stdio: ['pipe', 'pipe', 'inherit']
});

function sendMessage(message) {
  const content = JSON.stringify(message);
  const header = `Content-Length: ${content.length}\r\n\r\n`;
  console.log(`📤 Sending: ${message.method}${message.id ? ` (id: ${message.id})` : ''}`);
  lsp.stdin.write(header + content);
}

// Test sequence
setTimeout(() => {
  sendMessage({
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: {
      processId: process.pid,
      capabilities: { textDocument: { definition: {} } }
    }
  });
}, 100);

setTimeout(() => {
  sendMessage({
    jsonrpc: '2.0',
    method: 'initialized',
    params: {}
  });
}, 200);

setTimeout(() => {
  sendMessage({
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
  });
}, 300);

// Test 1: Method call
setTimeout(() => {
  console.log('\n🎯 TEST 1: Method call definition');
  console.log('Line 6: "call(:my_method)" - position on "my_method"');
  sendMessage({
    jsonrpc: '2.0',
    id: 10,
    method: 'textDocument/definition',
    params: {
      textDocument: { uri: 'file:///debug/connector.rb' },
      position: { line: 6, character: 14 }
    }
  });
}, 500);

// Test 2: Object definition
setTimeout(() => {
  console.log('\n🎯 TEST 2: Object definition reference');
  console.log('Line 7: "object_definitions["user"]" - position on "user"');
  sendMessage({
    jsonrpc: '2.0',
    id: 11,
    method: 'textDocument/definition',
    params: {
      textDocument: { uri: 'file:///debug/connector.rb' },
      position: { line: 7, character: 33 }
    }
  });
}, 700);

// Test 3: Field reference
setTimeout(() => {
  console.log('\n🎯 TEST 3: Field reference');
  console.log('Line 8: "input["test_field"]" - position on "test_field"');
  sendMessage({
    jsonrpc: '2.0',
    id: 12,
    method: 'textDocument/definition',
    params: {
      textDocument: { uri: 'file:///debug/connector.rb' },
      position: { line: 8, character: 20 }
    }
  });
}, 900);

// Handle responses
lsp.stdout.on('data', (data) => {
  const str = data.toString();
  console.log('\n📥 Response received:', str.replace(/\r\n/g, '\\r\\n'));
});

lsp.on('close', (code) => {
  console.log(`\n✅ LSP server exited with code ${code}`);
  process.exit(0);
});

// Keep alive for 10 seconds
setTimeout(() => {
  console.log('\n⏰ Timeout - closing server');
  lsp.kill();
}, 10000);