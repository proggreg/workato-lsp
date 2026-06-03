{
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
}