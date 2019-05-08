require "optparse"
require_relative "./client/stateful"
require_relative "./client/stateless"
require_relative "./crc"
require_relative "./sum"

class App
  def initialize(host)
    @host    = host
    @options = {}

    @parser = OptionParser.new do |args|
      args.on("-m MODE")       { |m| @options[:mode]  = m }
      args.on("-n N", Integer) { |n| @options[:count] = n }
      args.on("-p P", Integer) { |p| @options[:port]  = p }
    end
  end

  def run(argv)
    @parser.parse!(argv)

    case @options[:mode]
    when "sum" then client, app = sum_app
    when "crc" then client, app = crc_app
    else
      raise "-m argument must be either 'sum' or 'crc'"
    end

    result = app.run
    client.close

    result
  end

  private

  def sum_app
    client = Client::Stateless.new(@host, @options[:port])
    [client, Sum.new(client, @options[:count])]
  end

  def crc_app
    count  = @options[:count] || 1 + rand(0xffff)
    client = Client::Stateful.new(@host, @options[:port], "count" => count)
    [client, CRC.new(client)]
  end
end
