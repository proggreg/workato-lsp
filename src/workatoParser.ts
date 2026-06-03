export interface WorkatoConnectorStructure {
  title?: string;
  connection?: ConnectionConfig;
  test?: TestConfig;
  actions?: { [key: string]: ActionConfig };
  triggers?: { [key: string]: TriggerConfig };
  object_definitions?: { [key: string]: ObjectDefinition };
  pick_lists?: { [key: string]: PickList };
  methods?: { [key: string]: MethodDefinition };
  secure_tunnel?: SecureTunnelConfig;
  webhook_keys?: WebhookKeys;
  streams?: StreamConfig;
}

export interface ConnectionConfig {
  fields?: FieldDefinition[];
  authorization?: AuthorizationConfig;
  base_uri?: string | (() => string);
}

export interface TestConfig {
  (): boolean | Promise<boolean>;
}

export interface ActionConfig {
  title?: string;
  subtitle?: string;
  description?: string;
  help?: string;
  input_fields?: FieldDefinition[] | (() => FieldDefinition[]);
  output_fields?: FieldDefinition[] | (() => FieldDefinition[]);
  execute?: (input: any, connection: any) => any;
  sample_output?: any;
  summarize_in?: string[];
  summarize_out?: string[];
}

export interface TriggerConfig {
  title?: string;
  subtitle?: string;
  description?: string;
  help?: string;
  input_fields?: FieldDefinition[] | (() => FieldDefinition[]);
  output_fields?: FieldDefinition[] | (() => FieldDefinition[]);
  webhook_subscribe?: (webhook_url: string, connection: any, input: any) => any;
  webhook_unsubscribe?: (webhook: any, connection: any) => any;
  webhook_notification?: (input: any, payload: any, extended_input_schema?: any, extended_output_schema?: any, headers?: any, params?: any) => any;
  poll?: (connection: any, input: any, page?: any) => any;
  dedup?: (record: any) => string;
  sample_output?: any;
}

export interface FieldDefinition {
  name: string;
  label?: string;
  type?: 'string' | 'integer' | 'number' | 'boolean' | 'date' | 'date_time' | 'object' | 'array';
  control_type?: 'text' | 'textarea' | 'password' | 'number' | 'select' | 'multiselect' | 'checkbox' | 'date' | 'date_time';
  optional?: boolean;
  hint?: string;
  properties?: FieldDefinition[];
  of?: 'string' | 'integer' | 'object';
  pick_list?: string | (() => Array<{ label: string; value: string }>);
  toggle_hint?: string;
  toggle_field?: FieldDefinition;
  change_on_blur?: boolean;
  support_pills?: boolean;
  delimiter?: string;
  list_mode?: 'static' | 'dynamic';
  list_mode_toggle?: FieldDefinition;
  item_label?: string;
  add_item_label?: string;
  empty_list_title?: string;
  empty_list_text?: string;
}

export interface AuthorizationConfig {
  type?: 'api_key' | 'basic_auth' | 'oauth2' | 'custom';
  credentials?: (connection: any) => any;
  refresh_on?: number[];
  detect_on?: string[];
  apply?: (connection: any) => any;
}

export interface ObjectDefinition {
  fields: FieldDefinition[] | (() => FieldDefinition[]);
}

export interface PickList {
  (): Array<{ label: string; value: string }>;
}

export interface MethodDefinition {
  (...args: any[]): any;
}

export interface SecureTunnelConfig {
  [key: string]: any;
}

export interface WebhookKeys {
  [key: string]: string;
}

export interface StreamConfig {
  [key: string]: any;
}

export class WorkatoParser {
  static validateConnectorStructure(content: string): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    try {
      if (!content.trim()) {
        return { isValid: false, errors: ['Empty file'] };
      }

      if (!content.includes('{') || !content.includes('}')) {
        errors.push('Connector must be defined as a Ruby hash with curly braces');
      }

      const requiredRootKeys = ['title'];
      const optionalRootKeys = ['connection', 'test', 'actions', 'triggers', 'object_definitions', 'pick_lists', 'methods', 'secure_tunnel', 'webhook_keys', 'streams'];
      const allValidKeys = [...requiredRootKeys, ...optionalRootKeys];

      const keyPattern = /(\w+):\s*[^,}]+/g;
      const foundKeys: string[] = [];
      let match;
      
      while ((match = keyPattern.exec(content)) !== null) {
        foundKeys.push(match[1]);
      }

      for (const requiredKey of requiredRootKeys) {
        if (!foundKeys.includes(requiredKey)) {
          errors.push(`Missing required root key: '${requiredKey}'`);
        }
      }

      for (const foundKey of foundKeys) {
        if (!allValidKeys.includes(foundKey)) {
          errors.push(`Unknown root key: '${foundKey}'. Valid keys are: ${allValidKeys.join(', ')}`);
        }
      }

      if (content.includes('lambda do') || content.includes('-> {')) {
        const lambdaPattern = /lambda\s+do|-> \{/g;
        const lambdaMatches = content.match(lambdaPattern);
        if (lambdaMatches) {
          const endPattern = /end|\}/g;
          const endMatches = content.match(endPattern);
          if (!endMatches || lambdaMatches.length > endMatches.length) {
            errors.push('Unmatched lambda blocks detected');
          }
        }
      }

    } catch (error) {
      errors.push(`Parse error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    return { isValid: errors.length === 0, errors };
  }

  static getConnectorRootKeys(): string[] {
    return ['title', 'connection', 'test', 'actions', 'triggers', 'object_definitions', 'pick_lists', 'methods', 'secure_tunnel', 'webhook_keys', 'streams'];
  }

  static getActionKeys(): string[] {
    return ['title', 'subtitle', 'description', 'help', 'input_fields', 'output_fields', 'execute', 'sample_output', 'summarize_in', 'summarize_out'];
  }

  static getTriggerKeys(): string[] {
    return ['title', 'subtitle', 'description', 'help', 'input_fields', 'output_fields', 'webhook_subscribe', 'webhook_unsubscribe', 'webhook_notification', 'poll', 'dedup', 'sample_output'];
  }

  static getConnectionKeys(): string[] {
    return ['fields', 'authorization', 'base_uri'];
  }

  static getFieldKeys(): string[] {
    return ['name', 'label', 'type', 'control_type', 'optional', 'hint', 'properties', 'of', 'pick_list', 'toggle_hint', 'toggle_field'];
  }

  static getRubyMethodsAllowed(): string[] {
    return [
      'puts',
      'Array.wrap',
      'reduce',
      'find_all',
      'reinvoke_after',
      'workato.stream.out',
      'workato.stream.in',
      'get',
      'post',
      'put',
      'patch',
      'delete',
      'request',
      'headers',
      'payload',
      'params',
      'after_error_response',
      'after_response'
    ];
  }
}