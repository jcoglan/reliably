require "securerandom"
require_relative "../client"

class Client
  class Stateful

    def initialize(host, port, args = {})
      @args = args
      @uuid = SecureRandom.uuid

      @client = Client.new(host, port) { connect_message }
    end

    def close
      @client.close
    end

    def read_message
      @client.read_message["data"]
    end

    private

    def connect_message
      { "uuid" => @uuid, "params" => @args }
    end

  end
end
