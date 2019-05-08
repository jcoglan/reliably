class Sum
  def initialize(client, count)
    @client = client
    @count  = count
    @sum    = 0
  end

  def run
    @count.times do
      data = @client.read_message
      @sum += data.to_i(10)
    end

    @sum
  end
end
