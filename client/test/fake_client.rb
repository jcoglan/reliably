class FakeClient
  def initialize(messages)
    @messages = messages
  end

  def read_message
    @messages.shift
  end

  def send_message(message)
  end

  def close
  end
end
