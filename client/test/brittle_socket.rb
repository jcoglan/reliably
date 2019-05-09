require "socket"

class BrittleSocket
  def initialize(host, port)
    raise Errno::ECONNREFUSED if rand(5) == 0

    @socket = TCPSocket.new(host, port)
  end

  def close
    @socket.close
  end

  def puts(message)
    maybe { @socket.puts(message) }
  end

  def readline
    maybe { @socket.readline }
  end

  private

  def maybe
    case rand(6)
    when 0 then raise Errno::ECONNRESET
    when 1 then raise EOFError
    end

    yield

  rescue
    @socket.close
    raise
  end
end
