# Workato LSP (Language Server Protocol)

A Language Server Protocol implementation for Workato Connector SDK development, providing intelligent code assistance for Ruby-based Workato connectors.

## Features

- **Syntax Validation**: Real-time validation of Workato connector structure and syntax
- **Auto-completion**: Intelligent code completion for:
  - Root connector keys (title, connection, actions, triggers, etc.)
  - Action and trigger configurations
  - Field definitions and types
  - Workato SDK methods
- **Go to Definition**: Navigate to definitions of:
  - `object_definitions["name"]` → object definition
  - `pick_list: "name"` → pick list definition  
  - `call(:method_name)` → method definition
  - `input["field"]` / `connection["field"]` → field definition
  - Action and trigger references
- **Error Detection**: Identifies common issues such as:
  - Missing required fields
  - Invalid Ruby syntax
  - Unmatched braces and lambda blocks
  - Restricted method usage
- **Context-aware Suggestions**: Provides relevant completions based on current context

## Installation

1. Clone the repository:
```bash
git clone https://github.com/your-org/workato-lsp.git
cd workato-lsp
```

2. Install dependencies:
```bash
npm install
```

3. Build the project:
```bash
npm run build
```

## Usage

### As a Standalone Server

Start the LSP server:
```bash
npm start
```

The server will listen on stdin/stdout for LSP messages.

### With VS Code

To use with VS Code, you'll need to create a VS Code extension that connects to this LSP server. See the [VS Code Language Server Extension Guide](https://code.visualstudio.com/api/language-extensions/language-server-extension-guide) for details.

### Development

Watch mode for development:
```bash
npm run watch
```

Test specific features:
```bash
npm run test-simple      # Basic LSP functionality
npm run test-definition  # Go to Definition feature
npm test                # Full validation test
```

## Supported Workato Connector Features

### Root Keys
- `title` - Connector display name
- `connection` - Connection configuration
- `test` - Connection test function
- `actions` - Available actions
- `triggers` - Available triggers
- `object_definitions` - Reusable object schemas
- `pick_lists` - Dropdown list providers
- `methods` - Helper methods

### Action/Trigger Properties
- `title`, `subtitle`, `description` - Display information
- `input_fields`, `output_fields` - Field definitions
- `execute` - Main action logic
- `webhook_subscribe`, `webhook_notification` - Webhook handling
- `poll` - Polling trigger logic

### Field Types
- Basic: `string`, `integer`, `number`, `boolean`, `date`, `date_time`
- Complex: `object`, `array`
- Control types: `text`, `textarea`, `password`, `select`, `checkbox`

### Workato SDK Methods
- HTTP methods: `get`, `post`, `put`, `patch`, `delete`
- Utilities: `puts`, `Array.wrap`, `reduce`, `find_all`
- Streaming: `workato.stream.in`, `workato.stream.out`

## File Structure

```
src/
├── server.ts           # Main LSP server
├── workatoParser.ts    # Workato connector parsing and validation
├── workatoValidator.ts # Document validation logic
└── workatoCompletion.ts # Auto-completion provider

examples/
└── sample-connector.rb # Example Workato connector
```

## Example Connector

See `examples/sample-connector.rb` for a complete example of a Workato connector with all major features implemented.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

MIT License - see LICENSE file for details.

## Related Projects

- [Workato Connector SDK](https://github.com/workato/workato-connector-sdk) - Official Workato SDK
- [VS Code Language Server Protocol](https://microsoft.github.io/language-server-protocol/) - LSP specification