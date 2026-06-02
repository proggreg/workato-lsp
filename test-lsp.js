const { spawn } = require('child_process');
const path = require('path');

const serverPath = path.join(__dirname, 'out', 'server.js');

console.log('Testing Workato LSP Server...');
console.log('Starting server at:', serverPath);

const lsp = spawn('node', [serverPath, '--stdio'], {
  stdio: ['pipe', 'pipe', 'inherit']
});

const testMessages = [
  // Initialize request
  {
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: {
      processId: process.pid,
      rootUri: null,
      capabilities: {
        textDocument: {
          completion: {
            completionItem: {
              snippetSupport: true
            }
          }
        }
      }
    }
  },
  
  // Initialized notification
  {
    jsonrpc: '2.0',
    method: 'initialized',
    params: {}
  },
  
  // Test completion request
  {
    jsonrpc: '2.0',
    id: 2,
    method: 'textDocument/completion',
    params: {
      textDocument: {
        uri: 'file:///test/connector.rb'
      },
      position: {
        line: 0,
        character: 0
      }
    }
  }
];

function sendMessage(message) {
  const content = JSON.stringify(message);
  const header = `Content-Length: ${content.length}\r\n\r\n`;
  lsp.stdin.write(header + content);
}

let messageIndex = 0;

function sendNextMessage() {
  if (messageIndex < testMessages.length) {
    console.log(`Sending message ${messageIndex + 1}:`, JSON.stringify(testMessages[messageIndex], null, 2));
    sendMessage(testMessages[messageIndex]);
    messageIndex++;
    setTimeout(sendNextMessage, 100);
  } else {
    console.log('All messages sent. Waiting for responses...');
    setTimeout(() => {
      console.log('Test complete. Closing server.');
      lsp.kill();
    }, 2000);
  }
}

lsp.stdout.on('data', (data) => {
  const response = data.toString();
  console.log('Server response:', response);
});

lsp.on('close', (code) => {
  console.log(`LSP server exited with code ${code}`);
});

lsp.on('error', (err) => {
  console.error('LSP server error:', err);
});

setTimeout(sendNextMessage, 100);