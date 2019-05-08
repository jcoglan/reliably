require "zlib"

class CRC
  OK   = "OK"
  FAIL = "FAIL"

  def initialize(client)
    @client = client
    @crc    = 0
  end

  def run
    loop do
      data = @client.read_message
      @crc = Zlib.crc32([data["value"]].pack("N"), @crc)

      if data["crc"]
        return (@crc == data["crc"]) ? OK : FAIL
      end
    end
  end
end
