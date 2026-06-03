{
  title: "Sample Connector",

  connection: {
    authorization: {
      type: "custom",

      apply: lambda do |connection|
        headers("Authorization" => "Bearer #{call(:get_token, connection)}")
      end
    }
  },

  actions: {
    get_user: {
      input_fields: lambda do
        [{ name: "user_id", type: "string" }]
      end,

      execute: lambda do |connection, input|
        response = call(:make_request, "GET", "/users/#{input['user_id']}")
        call(:format_response, response)
            call(:make_request, method, path)
      end,

      output_fields: lambda do
        [{ name: "id" }, { name: "name" }, { name: "email" }]
      end
    }
  },

  methods: {
    get_token: lambda do |connection|
        connection["api_token"]
    end,

    make_request: lambda do |method, path|
      {
        url: "https://api.example.com#{path}",
        method: method
      }
    end,

    format_response: lambda do |response|
      response.dig("data") || response
    end
  }
}
