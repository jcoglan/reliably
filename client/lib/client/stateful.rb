require "securerandom"
require_relative "../client"

class Client
  class Stateful

    def initialize(host, port, args = {})
      @args = args
      @last = -1
      @uuid = SecureRandom.uuid

      @client = Client.new(host, port) { connect_message }
    end

    def close
      @client.close
    end

    def read_message
      message = @client.read_message
      @last   = [@last, message["id"]].max

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
