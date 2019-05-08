require "minitest/autorun"
require "fake_client"
require "crc"

describe Sum do
  before do
    @client = FakeClient.new([
      { "value" => 552680663 },
      { "value" => 4175747998 },
      { "value" => 541024752 },
      { "value" => 1760696672 },
      { "value" => 3373646083, "crc" => crc }
    ])
  end

  describe "when the CRC matches" do
    def crc
      4038291058
    end

    it "returns OK" do
      sum = CRC.new(@client)
      assert_equal "OK", sum.run
    end
  end

  describe "when the CRC does not match" do
    def crc
      40
    end

    it "returns FAIL" do
      sum = CRC.new(@client)
      assert_equal "FAIL", sum.run
    end
  end
end

