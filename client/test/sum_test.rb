require "minitest/autorun"
require "fake_client"
require "sum"

describe Sum do
  before do
    @client = FakeClient.new((1..10).map(&:to_s))
  end

  it "sums the first N messages from the client" do
    sum = Sum.new(@client, 5)
    assert_equal 15, sum.run
  end
end
