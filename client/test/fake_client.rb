class FakeClient
  def initialize(messages)
    @messages = messages
  end

  def read_message
    @messages.shift
  end

  def close
  end
end
