require "minitest/autorun"
require "fake_client"
require "app"

describe App do
  before do
    @app = App.new("localhost")
  end

  describe "sum" do
    before do
      messages = (1..10).map { |n| { "data" => n.to_s } }
      @client  = FakeClient.new(messages)
    end

    it "sums the first N values from the server" do
      Client.stub :new, @client do
        result = @app.run(%w[-m sum -n 5])
        assert_equal 15, result
      end
    end
  end

  describe "crc" do
    before do
      @client = FakeClient.new([
        { "data" => { "value" => 552680663 } },
        { "data" => { "value" => 4175747998 } },
        { "data" => { "value" => 541024752 } },
        { "data" => { "value" => 1760696672 } },
        { "data" => { "value" => 3373646083, "crc" => 4038291058 } }
      ])
    end

    it "checks the CRC of the stream" do
      Client.stub :new, @client do
        result = @app.run(%w[-m crc])
        assert_equal "OK", result
      end
    end
  end
end
