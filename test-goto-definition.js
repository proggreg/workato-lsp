const { spawn } = require('child_process');
const path = require('path');

const serverPath = path.join(__dirname, 'out', 'server.js');

console.log('Testing Go to Definition...');

const lsp = spawn('node', [serverPath, '--stdio'], {
  stdio: ['pipe', 'pipe', 'inherit']
});

// Sample connector with references to test
const connectorContent = `{
  title: "Test Connector",
  
  connection: {
    fields: [
      {
        name: "api_key",
        type: "password"
      }
    ]
  },
  
  actions: {
    get_user: {
      title: "Get User",
      input_fields: lambda do
        [
          { name: "user_id", type: "string" }
        ]
      end,
      
      output_fields: lambda do
        object_definitions["user"]
      end,
      
      execute: lambda do |input, connection|
        user_id = input["user_id"]
        api_key = connection["api_key"]
        call(:format_response, response)
      end
    }
  },
  
  object_definitions: {
    user: {
      fields: lambda do
        [
          { name: "id", type: "integer" },
          { name: "name", type: "string" }
        ]
      end
    }
  },
  
  methods: {
    format_response: lambda do |response|
      { formatted: response }
    end
  }
}`;

const testMessages = [
  // Initialize
  {
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: {
      processId: process.pid,
      rootUri: 'file:///test',
      capabilities: {
        textDocument: {
          definition: {},
          publishDiagnostics: {}
        }
      }
    }
  },
  
  // Initialized
  {
    jsonrpc: '2.0',
    method: 'initialized',
    params: {}
  },
  
  // Open document
  {
    jsonrpc: '2.0',
    method: 'textDocument/didOpen',
    params: {
      textDocument: {
        uri: 'file:///test/connector.rb',
        languageId: 'ruby',
        version: 1,
        text: connectorContent
      }
    }
  },
  
  // Test go to definition on object_definitions["user"]
  {
    jsonrpc: '2.0',
    id: 2,
    method: 'textDocument/definition',
    params: {
      textDocument: {
        uri: 'file:///test/connector.rb'
      },
      position: {
        line: 18, // Line with object_definitions["user"]
        character: 25 // Position on "user"
      }
    }
  },
  
  // Test go to definition on input["user_id"]
  {
    jsonrpc: '2.0',
    id: 3,
    method: 'textDocument/definition',
    params: {
      textDocument: {
        uri: 'file:///test/connector.rb'
      },
      position: {
        line: 22, // Line with input["user_id"]
        character: 22 // Position on "user_id"
      }
    }
  },
  
  // Test go to definition on call(:format_response)
  {
    jsonrpc: '2.0',
    id: 4,
    method: 'textDocument/definition',
    params: {
      textDocument: {
        uri: 'file:///test/connector.rb'
      },
      position: {
        line: 24, // Line with call(:format_response)
        character: 15 // Position on "format_response"
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
    const message = testMessages[messageIndex];
    console.log(`\n--- Sending ${message.method || 'request'} (${message.id || 'notification'}) ---`);
    if (message.id) {
      console.log('Testing position:', JSON.stringify(message.params?.position));
    }
    sendMessage(message);
    messageIndex++;
    setTimeout(sendNextMessage, 300);
  } else {
    console.log('\n=== All messages sent. Waiting for responses... ===');
    setTimeout(() => {
      console.log('Test complete. Closing server.');
      lsp.kill();
    }, 2000);
  }
}

lsp.stdout.on('data', (data) => {
  const response = data.toString();
  console.log('\n--- Server Response ---');
  
  // Parse LSP messages
  const lines = response.split('\r\n');
  let inContent = false;
  
  for (const line of lines) {
    if (line.startsWith('Content-Length:')) {
      inContent = false;
    } else if (line === '') {
      inContent = true;
    } else if (inContent && line.trim()) {
      try {
        const parsed = JSON.parse(line);
        if (parsed.result && parsed.result.uri) {
          console.log('✅ DEFINITION FOUND:');
          console.log('  URI:', parsed.result.uri);
          console.log('  Range:', JSON.stringify(parsed.result.range, null, 2));
        } else if (parsed.result === null) {
          console.log('❌ No definition found');
        } else {
          console.log('Response:', JSON.stringify(parsed, null, 2));
        }
      } catch (e) {
        console.log('Raw response:', line);
      }
    }
  }
});

lsp.on('close', (code) => {
  console.log(`\nLSP server exited with code ${code}`);
});

lsp.on('error', (err) => {
  console.error('LSP server error:', err);
});

setTimeout(sendNextMessage, 100);