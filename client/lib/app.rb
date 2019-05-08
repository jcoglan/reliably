require "optparse"
require_relative "./client/stateless"
require_relative "./sum"

class App
  def initialize(host)
    @host    = host
    @options = {}

    @parser = OptionParser.new do |args|
      args.on("-n N", Integer) { |n| @options[:count] = n }
      args.on("-p P", Integer) { |p| @options[:port]  = p }
    end
  end

  def run(argv)
    @parser.parse!(argv)

    client = Client::Stateless.new(@host, @options[:port])
    app    = Sum.new(client, @options[:count])
    result = app.run

    client.close
    result
  end
end
