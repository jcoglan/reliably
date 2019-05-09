require "json"
require "socket"

class Client
  DELAY_INC = 5
  DELAY_MAX = 60

  def initialize(host, port, &on_connect)
    @host  = host
    @port  = port
    @sock  = nil
    @delay = 0

    @on_connect = on_connect
  end

  def close
    @sock&.close
  end

  def read_message
    with_socket { |sock| JSON.parse(sock.readline) }
  end

  def send_message(message)
    with_socket { |sock| sock.puts(JSON.dump(message)) }
  end

  private

  def with_socket
    open_socket
    yield @sock
  rescue EOFError, Errno::ECONNRESET
    @sock = nil
    retry
  end

  def open_socket
    return if @sock

    @sock  = TCPSocket.new(@host, @port)
    @delay = 0

    send_initial_message

  rescue Errno::ECONNREFUSED, SocketError
    @delay += DELAY_INC if @delay < DELAY_MAX
    sleep @delay
    retry
  end

  def send_initial_message
    message = @on_connect.call
    @sock.puts(JSON.dump(message))
  end
end
