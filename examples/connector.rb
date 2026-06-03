{
  title: 'Sample API Connector',

  connection: {
    fields: [
      {
        name: 'api_key',
        type: 'password',
        control_type: 'password',
        hint: 'Your API key from the service dashboard'
      },
      {
        name: 'base_url',
        type: 'string',
        control_type: 'text',
        hint: 'Base URL for the API (e.g., https://api.example.com)'
      }
    ],

    authorization: {
      type: 'api_key',

      credentials: lambda do |connection|
        headers("Authorization": "Bearer #{connection['api_key']}")
      end,

      refresh_on: [401, 403],

      detect_on: [
        /Invalid API key/,
        /Unauthorized/
      ]
    },

    base_uri: lambda do |connection|
      connection['base_url'] || 'https://api.example.com'
    end
  },

  test: lambda do |connection|
    get('/api/v1/test', connection)
  end,

  actions: {
    get_users:
    {
      title: 'Get users',
      subtitle: 'Retrieve all users from the system',
      description: 'This action fetches a list of all users in the system',

      input_fields: lambda do
        [
          {
            name: 'limit',
            type: 'integer',
            control_type: 'number',
            optional: true,
            hint: 'Maximum number of users to retrieve (default: 100)'
          },
          {
            name: 'status',
            type: 'string',
            control_type: 'select',
            pick_list: 'user_statuses',
            optional: true,
            hint: 'Filter users by status'
          }
        ]
      end,

      output_fields: lambda do
        [
          {
            name: 'users',
            type: 'array',
            of: 'object',
            properties: [
              { name: 'id', type: 'integer' },
              { name: 'name', type: 'string' },
              { name: 'email', type: 'string' },
              { name: 'status', type: 'string' },
              { name: 'created_at', type: 'date_time' }
            ]
          },
          {
            name: 'total_count',
            type: 'integer'
          }
        ]
      end,

      execute: lambda do |input, connection|
        response = get('/api/v1/users')
                   .params(limit: input['limit'], status: input['status'])
                   .request(connection)

        call(:format_error, email)
        call(:format_error, email)
        call(:format_error, email)
        call(:format_error, email)
        {
          users: response['data'],
          total_count: response['total_count']
        }
      end,

      sample_output: {
        users: [
          {
            id: 1,
            name: 'John Doe',
            email: 'john@example.com',
            status: 'active',
            created_at: '2023-01-15T10:30:00Z'
          }
        ],
        total_count: 1
      }
    },
    create_user: {
      title: 'Create user',
      subtitle: 'Create a new user in the system',

      input_fields: lambda do
        [
          {
            name: 'name',
            type: 'string',
            control_type: 'text',
            hint: 'Full name of the user'
          },
          {
            name: 'email',
            type: 'string',
            control_type: 'email',
            hint: 'Email address of the user'
          },
          {
            name: 'role',
            type: 'string',
            control_type: 'select',
            pick_list: 'user_roles',
            optional: true,
            hint: 'Role to assign to the user'
          }
        ]
      end,

      output_fields: lambda do
        object_definitions['user']
      end,

      execute: lambda do |input, connection|
        post('/api/v1/users', input).request(connection)
        call(:validate_email, email)

        call(:format, email)
        call(:format_error, error)
        call(:method_multi_params, param1, param2)

        call(:format_error, error)
      end
    }
  },

  triggers: {
    new_user: {
      title: 'New user',
      subtitle: 'Triggers when a new user is created',

      input_fields: lambda do
        [
          {
            name: 'status_filter',
            type: 'string',
            control_type: 'select',
            pick_list: 'user_statuses',
            optional: true,
            hint: 'Only trigger for users with this status'
          }
        ]
      end,

      output_fields: lambda do
        object_definitions['user']
      end,

      poll: lambda do |connection, input, page|
        page ||= 1

        response = get('/api/v1/users')
                   .params(
                     page: page,
                     per_page: 100,
                     status: input['status_filter'],
                     created_since: (Time.now - 1.hour).iso8601
                   )
                   .request(connection)

        {
          events: response['data'],
          next_page: response['has_more'] ? page + 1 : nil
        }
      end,

      dedup: lambda do |user|
        user['id']
      end,

      sample_output: {
        id: 1,
        name: 'John Doe',
        email: 'john@example.com',
        status: 'active',
        created_at: '2023-01-15T10:30:00Z'
      }
    },
    my_new_trigger: {}
  },

  object_definitions: {
    user: {
      fields: lambda do
        [
          { name: 'id', type: 'integer' },
          { name: 'name', type: 'string' },
          { name: 'email', type: 'string' },
          { name: 'status', type: 'string' },
          { name: 'role', type: 'string' },
          { name: 'created_at', type: 'date_time' },
          { name: 'updated_at', type: 'date_time' }
        ]
      end
    }
  },

  pick_lists: {
    user_statuses: lambda do
      [
        %w[Active active],
        %w[Inactive inactive],
        %w[Pending pending],
        %w[Suspended suspended]
      ]
    end,

    user_roles: lambda do
      [
        %w[Administrator admin],
        %w[Manager manager],
        %w[User user],
        %w[Guest guest]
      ]
    end
  },

  methods: {
    format_error: lambda do |error|
      puts "Error occurred: #{error.message}"
      puts
      {
        error: error.message,
        timestamp: Time.now.iso8601
      }
    end,

    validate_email: lambda do |email|
      email.match?(/\A[\w+\-.]+@[a-z\d-]+(\.[a-z\d-]+)*\.[a-z]+\z/i)
    end,

    method_multi_params: lambda do |param1, param2|
      puts("param1 #{param1} param2 #{param2}")
    end,
    method_multi_params: lambda do |param1, param2|
      puts("param1 #{param1} param2 #{param2}")
    end,
    method_multi_params: lambda do |param1, param2|
      puts("param1 #{param1} param2 #{param2}")
    end,
    method_multi_params: lambda do |param1, param2|
      puts("param1 #{param1} param2 #{param2}")
    end
  }
}
