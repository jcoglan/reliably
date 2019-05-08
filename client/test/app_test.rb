require "minitest/autorun"
require "fake_client"
require "app"

describe App do
  before do
    messages = (1..10).map { |n| { "data" => n.to_s } }
    @client  = FakeClient.new(messages)

    @app = App.new("localhost")
  end

  it "sums the first N values from the server" do
    Client.stub :new, @client do
      result = @app.run(%w[-n 5])
      assert_equal 15, result
    end
  end
end
