require "securerandom"
require_relative "../client"

class Client
  class Stateful

    ACK_FREQUENCY = 16

    def initialize(host, port, socket, args = {})
      @args = args
      @last = -1
      @uuid = SecureRandom.uuid

      @client = Client.new(host, port, socket) { connect_message }
    end

    def close
      @client.close
    end

    def read_message
      message = @client.read_message
      @last   = [@last, message["id"]].max

      if @last % ACK_FREQUENCY == 0
        @client.send_message("uuid" => @uuid, "ack" => @last)
      end

      message["data"]
    end

    private

    def connect_message
      @last < 0 ? init_message : reconnect_message
    end

    def init_message
      { "uuid" => @uuid, "params" => @args }
    end

    def reconnect_message
      { "uuid" => @uuid, "state" => @last }
    end

  end
end
