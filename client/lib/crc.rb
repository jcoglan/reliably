require "zlib"

class CRC
  OK   = "ok"
  FAIL = "fail"

  def initialize(client)
    @client = client
    @crc    = 0
  end

  def run
    loop do
      data = @client.read_message
      @crc = Zlib.crc32([data["value"]].pack("N"), @crc)

      if data["crc"]
        status = (@crc == data["crc"]) ? OK : FAIL
        return [@crc, status]
      end
    end
  end
end
