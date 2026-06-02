const { spawn } = require('child_process');
const path = require('path');

const serverPath = path.join(__dirname, 'out', 'server.js');

console.log('🐛 Starting LSP server with Node debugger');
console.log('Open Chrome and go to: chrome://inspect');
console.log('Click "inspect" on the remote target that appears');
console.log('========================');

// Start LSP server with debugger
const lsp = spawn('node', [
  '--inspect-brk=9229',  // Start with debugger and break immediately
  serverPath,
  '--stdio'
], {
  stdio: ['pipe', 'pipe', 'inherit']
});

console.log('Server started with debugger on port 9229');
console.log('Waiting 5 seconds for you to attach debugger...');

setTimeout(() => {
  console.log('Sending test messages...');
  
  const connector = `{
  title: "Debug",
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

  function sendMessage(message) {
    const content = JSON.stringify(message);
    const header = `Content-Length: ${content.length}\r\n\r\n`;
    lsp.stdin.write(header + content);
  }

  // Send messages
  sendMessage({
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: { processId: process.pid, capabilities: { textDocument: { definition: {} } } }
  });
  
  setTimeout(() => {
    sendMessage({ jsonrpc: '2.0', method: 'initialized', params: {} });
  }, 100);
  
  setTimeout(() => {
    sendMessage({
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
    });
  }, 200);
  
  setTimeout(() => {
    console.log('🎯 Sending definition request - set breakpoint in workatoDefinition.ts!');
    sendMessage({
      jsonrpc: '2.0',
      id: 2,
      method: 'textDocument/definition',
      params: {
        textDocument: { uri: 'file:///test/connector.rb' },
        position: { line: 5, character: 14 } // On "my_method"
      }
    });
  }, 300);
  
}, 5000);

lsp.stdout.on('data', (data) => {
  console.log('Server response:', data.toString());
});

lsp.on('close', (code) => {
  console.log(`Server exited with code ${code}`);
});

// Keep process alive
process.stdin.resume();