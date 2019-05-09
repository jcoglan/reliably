require "minitest/autorun"
require "brittle_socket"
require "app"

describe "error recovery" do
  before do
    server = File.expand_path("../../../server/bin/server", __FILE__)
    @pid = Process.spawn("#{ server } 4180 10")

    @app = App.new("localhost", socket: BrittleSocket)
  end

  after do
    Process.kill("TERM", @pid)
  end

  describe CRC do
    it "receives all the messages from the server" do
      _crc, status = @app.run(%w[-p 4180 -m crc -n 100])
      assert_equal "ok", status
    end
  end
end
