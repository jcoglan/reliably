require_relative "../client"

class Client
  class Stateless

    def initialize(host, port, socket)
      @last   = nil
      @client = Client.new(host, port, socket) { connect_message }
    end

    def close
      @client.close
    end

    def read_message
      message = @client.read_message
      @last   = message["data"]
    end

    private

    def connect_message
      message = {}
      message["state"] = @last if @last

      message
    end

  end
end
