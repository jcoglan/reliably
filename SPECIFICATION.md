# Specification for reliable data streaming protocol

This document describes the wire protocol implemented by the client and server
in this repository. It has two variants: a stateless and stateful message
stream. A server must implement both these variants as a single service.


## Establishing a connection

All communication in this protocol is conducted over TCP. The client establishes
a TCP connection to the server and then sends an initial message as described in
the streaming modes below. The subsequent flow of the protocol depends on which
variant is requested by the client.

If the TCP connection is interrupted after having been successfully established,
the client may attempt to reconnect immediately, unless it has received an error
message. If the client fails to establish a connection, then it should wait at
least 5 seconds before retrying. It may retry using a fixed period, or using any
back-off strategy of its choosing. If it fails to re-establish a connection
within 30 seconds, then any state it has stored on the server may be lost.

On any successful TCP connection, whether a first-time connection or a
reconnection following an interruption, the client must send an initial message
indicating its request. The contents of such initial messages depends on the
streaming mode as described later in this document.


## Message format

Messages are formatted as JSON and separated by line feed characters. As line
feeds are used as message separators, each JSON message should be encoded as a
single line of text. The client and server must encode these messages as UTF-8.

If the client sends a message the server does not understand, cannot process, or
which violates the protocol, the server must send an error message and then
close the connection. These messages have the form:

    { "error": <message> }

`<message>` is a string containing a human-readable error message. If a client
receives such a message, it should immediately close its connection and not
attempt to resume its current stream.


## Streaming modes

The server must support two modes of operation: stateless and stateful. The mode
to use for each inbound connection is determined by the client's initial message
after the connection has been established.

The schema and flow of the messages between the client and server depend on
which mode is in use. On receipt of a message, the client and server must
silently ignore any fields in the message that they do not recognise.


### Stateless mode

The client requests a new stateless stream by sending the empty JSON message as
its initial message:

    {}

On receipt of such a message, the server must generate an indefinite stream of
integers, and send them one at a time to the client in the following message
format:

    { "data": <value> }

`<value>` must be a string containing the decimal representation of the
message's value. The server may send arbitrarily large integers in these
messages, and they are encoded as strings to prevent loss of precision if
processed by a JSON parser that cannot handle arbitrary-sized ints.

The server must continue to emit messages indefinitely; the client decides to
end the connection once it has received as many messages as it wants.

If the client loses its connection, then it should attempt to reconnect, and
then send an initial message whose `state` field contains the `data` value of
the last message the client processed before disconnection.

    { "state": <value> }

For example, if the last message the client received was `{ "data": "42" }`,
then on reconnection it should send the initial message `{ "state": "42" }`.

The server must recognise this initial message as a request to resume a stream,
and it must be able to do so knowing only the last value the client received. It
should continue to send values to the client beginning with the value after the
one the client has acknowledged.

For example, if the server generates this stream by multiplying each value by 2,
and if the client sends the following as its initial message:

    { "state": "23" }

Then the first three messages the server should send over this connection are:

    { "data": "46" }
    { "data": "92" }
    { "data": "184" }


### Stateful mode

The client requests a new stateful stream by sending an initial message
containing its randomly chosen UUID, and a `params` field containing `count`, an
integer in the range 1..0xffff to indicate how many messages it wants to
receive. For example:

    {
      "uuid": "bf575c35-c25b-4386-8430-d5e2a93f3b1a",
      "params": { "count": 28172 }
    }

(Although displayed on multiple lines here, remember that all messages must be
formatted as a single line when sent over the wire.)

The server must respond to this request by emitting a stream of N messages,
where N is the value of `params.count` in the client's initial message. The
messages must have a `data` field that contains `value`, an unsigned 32-bit
integer. These messages must carry an `id` field whose value is a monotonically
ascending unsigned 32-bit integer. For example:

    { "id": 1, "data": { "value": 1522805012 } }
    { "id": 2, "data": { "value": 3535044222 } }
    { "id": 3, "data": { "value": 402765600 } }

The final message in the stream must also have as part of its `data` a field
named `crc`, which contains the checksum of all the values sent in the stream.
For example, if the client requested 5 messages, the server's response may look
like:

    { "id": 1, "data": { "value": 1522805012 } }
    { "id": 2, "data": { "value": 3535044222 } }
    { "id": 3, "data": { "value": 402765600 } }
    { "id": 4, "data": { "value": 681225668 } }
    { "id": 5, "data": { "value": 505780829, "crc": 3848541339 } }

The `crc` value is computed by taking the rolling CRC-32 checksum of each number
in the stream, encoded as a big-endian uint32. The starting value for the
rolling CRC-32 is 0, and it should be represented as an unsigned 32-bit int.

For example, to compute the CRC-32 of the above stream in Ruby, we can use
zlib's crc32() function with a string containing the numbers in the appropriate
encoding.

    >> xs = [1522805012, 3535044222, 402765600, 681225668, 505780829]

    >> Zlib.crc32(xs.pack("N*"), 0)
    => 3848541339

    # or,

    >> xs.reduce(0) { |n, x| Zlib.crc32([x].pack("N"), n) }
    => 3848541339

The presence of the `data.crc` field indicates that this is the final message.
On receipt of this message, the client should verify the data it has received
and close the connection.

If the client loses its connection, then it should attempt to reconnect, and
then send an initial message whose `state` field contains the highest value for
the `id` field of any of the messages it has received before disconnection.

For example, a client receiving the above stream but getting disconnected after
message 3 should reconnect and send the initial message:

    { "uuid": "bf575c35-c25b-4386-8430-d5e2a93f3b1a", "state": 3 }

On receipt of such a message, the server should begin replaying the stream of
messages, starting from the one after the client has acknowledged. Any replayed
messages should be identical to those the server first attempted to deliver. For
example, a server receiving this message after generating the above stream
should send:

    { "id": 4, "data": { "value": 681225668 } }
    { "id": 5, "data": { "value": 505780829, "crc": 3848541339 } }

After sending the last message to the client, the server should close the
connection.

It is an error for a client to send a `state` message containing a `uuid` the
server has not seen before, or which has expired.

The client may implement an acknowledgement message to allow the server to
remove delivered messages from its storage during a long-running connection. The
client may send a message of the form:

    { "uuid": <uuid>, "ack": <id> }

This message must not be the first one that a client sends; it must send a
message containing either `params` or `state` first.

Unlike the `state` message, an `ack` should not cause the server to redeliver
messages after the given value. For example, if the server sends the following:

    { "id": 1, "data": { "value": 1522805012 } }
    { "id": 2, "data": { "value": 3535044222 } }
    { "id": 3, "data": { "value": 402765600 } }

The client, which may not have received message 3 yet, sends the following
message to indicate it has received all messages up to and including ID=2.

    { "uuid": "bf575c35-c25b-4386-8430-d5e2a93f3b1a", "ack": 2 }

The message informs the server of the client's state but should not alter the
messages sent during the connection. The server should continue by sending
message 4 after receiving this `ack` message. This is in contrast to a `state`
message, which indicates that the client wants the server to begin streaming
from the requested ID.

It is an error for a client to send an `ack` for a message it has not yet been
sent. It is an error for a client to send an `ack` with an ID that is less than
any previously sent `ack`.


## Session state

To support the stateful protocol, the server must maintain state for each client
session. Sessions are identified by the UUID chosen by the client when it first
connects. A single session may involve multiple connections, though these
connections must not overlap in time; each client must have at most one open
connection to the server at any moment.

The state needed to support a client session is divided into two layers:
messaging state, and application state, and we shall treat each separately.


### Messaging state

This is state that is necessary to support the reliable sending of a stream of
messages from the server to the client over an unreliable connection, regardless
of the contents or purpose of the messages or any application semantics built on
top of the stream.

The client must be able to reconnect, requesting that the stream resume from an
arbitrary point, as long as that point is later than any message the client has
already acknowledged. The server must not assume that the client has received
and processed any unacknowledged message. Therefore the server must store a
sequence of messages that it has attempted to deliver to the client. It should
only send messages to the client once they have been written to storage, and it
should only remove a message from storage once it has evidence of the client's
receipt of the message.

These messages must be identified by a unique monotonically ascending unsigned
32-bit integer. This allows the client to uniquely identify the latest message it
has seen without needing to store the whole stream -- it just has to track the
highest ID value it has received.

The server must store the ID of the last message that it sent. It cannot rely on
retrieving this ID from its internal message queue if it deletes any messages
the client has acknowledged.

Thus, the state required to support message delivery is:

- a sequence of message values
- the current message ID


### Application state

Application state is anything necessary to implement the chosen application on
top of the reliable message stream. In the case of the above protocol there are
three pieces of state that relate to the construction of the stream of `data`
values sent to the client:

- `count`, the number of messages remaining to be sent to the client; this is
  needed so that the server handling a reconnection knows how many more new
  messages it needs to generate for the client
- `value`, the last value that was generated, used to seed the next random
  value; this is needed so that the server can continue the random number
  sequence deterministically from the last message sent during the last
  connection
- `crc`, the rolling CRC-32 of the sequence of numbers in the messages; this is
  needed so that we can take the checksum over the whole message sequence
  without storing the entire stream

(This assumes that the stream of messages is generated incrementally as needed,
rather than the server generating a complete stream when the client first
connects.)

The server must provide space to store and update these values atomically with
the generation and storage of each new message. Failure to do this may result in
the CRC-32 being updated based on a message that ends up not being sent, or
sending a message and failing to log its effect on the CRC. Generating a new
message, persisting it, and updating the above two state values must be a single
atomic unit of work.

In the wire protocol, the `uuid`, `id`, `state`, and `ack` message fields relate
to messaging state: they are essential for tracking the delivery of messages.
The `params` and `data` message fields contain application state -- they play no
role in controlling the stream but instead convey application data between
peers.

These three values fully determine the value of the next generated message. The
protocol could be made stateless by sending this state to the client in place of
using message IDs. However, this increases the message size on the wire, and
also entrusts the client not to tamper with the checksum. The server should
really should be in control of tracking and checking what it has sent and should
not delegate that to the client. Using IDs also means the client-side
reconnection logic can be made independent of the application running on top of
the message stream.

Given that the server must _at least_ track the `crc` value itself, it makes
more sense for it to also store the `count` and `value` state and send opaque
IDs to the client. If the server sent the `count` and `value` to the client in
place of an ID, it would need to support resuming from arbitrary `{ count, value
}` states, and would need to remember the CRC at every such state. However, it
would not need to store the message sequence under this design, as the messages
could be regenerated from the reconstructed `{ count, value, crc }` states when
a client reconnects.


### Session API

The server is implemented as a Node.js program. The `Server` class takes an
object that must implement the following interface, to allow it to store the
necessary state for each client. The interface couples only to messaging state,
and should support arbitrary application state that is provided by the server.

The notation for the API methods indicates the effective type of each method.
The names in parens are the types of the method's parameters, and the type
following the arrow is the type of its return. Angle brackets indicate the type
contains some other value, for example `Promise<String>` would be a `Promise`
that yields a `String`. The empty brackets in `Promise<>` indicate that the
promise does not contain a value and is returned purely to indicate when the
method's effect is complete.

`UUID` is the type of client identifiers; in the above wire protocol they are
strings containing a UUID value.

`ID` is the type of message IDs; in the above protocol they are uint32 values.

`State` is the type of the application state; in this server `State` is an
object of type `{ count, value, crc }` where all fields are integers. However,
the session API should treat this type as opaque -- it is simply an arbitrary
structure containing application state. The only constraint is that it should be
able to be encoded as JSON.

`T` is the type of values contained in the `data` field of messages. In this
protocol `T` happens to be an object of the form `{ value, crc }`. Like `State`,
this interface should treat `T` as opaque, and assume only that it can be
round-tripped through JSON encoding.

`Message<T>` is the type of complete message values that are sent to the client,
having the form `{ id: ID, data: T }`

The notation `fn(State) => [T, State]` means a function that takes a `State` and
returns a pair of values `[T, State]`. This function is pure, so may be called
any number of times without side effects.

The complete session interface is as follows. As this module's effects may
require I/O, all the methods return promises. All the methods may throw an error
by returning a rejected promise. For example, all methods except `register()`
should throw an error when given a UUID that is not recognised. If one of these
methods does throw an error, the server will relay this failure to the client
via an error message, at which point the client should close its connection and
quit.

#### `register(UUID, State) => Promise<>`

Called when the server accepts a connection from a new client. Takes a UUID from
a new client and a state object. Must store the new client's initial state and
return a promise that resolves when this action is complete.

#### `disconnect(UUID) => Promise<>`

Called when the server detects that a client has disconnected. The session
module can use this to schedule the client's state for deletion.

#### `put(UUID, fn(State) => [T, State]) => Promise<Message<T>>`

Called when the server needs to generate a new message to send to the client.
Takes a client UUID and a _transformer_ function, and returns a promise
containing the new message.

This method should be implemented to execute the following steps as an atomic
unit of work, either using transactions or whatever consistency mechanism is
provided by the underlying storage.

- Load the state record (e.g. `{ count, value, crc }`) for the given client.
- Invoke the _transformer_ function, passing it the state. The function
  synchronously returns a pair of values of type `T` and `State` -- the data for
  the new message, and the new value of the state record. It does this by
  generating new values, not by mutating the original state object.
- Build a complete `Message<T>` from the `T` by generating a new ID for it.
- Commit the message to persistent storage
- Store the updated state record

It should return a promise for the new message object that was generated by this
process. This interface is designed so that the server will not send a message
to the client until it has been saved and the client's application state has
been consistently updated.

#### `after(UUID, ID) => Promise<Message<T>>`

Called when the client is resuming from a disconnection and needs to fetch old
messages to re-deliver them. ID here is the ID of the last message delivered to
the client.

Returns a promise for the message _immediately after_ the given ID in the
message stream. If no such message exists, this method must return a promise for
`null`, in which case the server will call `put()` to generate a new message.

#### `ack(UUID, ID) => Promise<>`

Called when the server receives advisory `ack` messages from the client to
indicate it has received every message up to the given ID.

This method must be implemented, but may have no effect. The implementation may
delete acknowledged messages if it likes.

Must return a promise that resolves after any cleanup effects have been carried
out.


### Random number generation

The following explains how the server uses the Session module to track the state
of each client stream, and how it generates random numbers.

When a new client connects, we call `sessions.register(uuid, state)` where
`state` is:

    {
      count: message.params.count,
      value: random,
      crc: 0
    }

`random` is a random uint32 generated using `Math.random()` and used to seed the
random sequence.

When the server wants to send the next message to the client, it calls
`sessions.after(uuid, id)` to check for an already-sent message. If that returns
nothing, then we use the following procedure to generate the next message in the
sequence:

    const Twister = require("mersenne-twister")

    sessions.put(uuid, (state) => {
      let value = new Twister(state.value).random_int()
      let crc   = updateCRC(state.crc, value)
      let data  = (state.count === 1) ? { value, crc } : { value }

      return [
        data,
        { count: state.count - 1, value, crc }
      ]
    })

The next pseudorandom value is generated using a Mersenne twister seeded with
the previous value; the precise implementation is the [mersenne-twister][MT]
library from npm.

The new CRC is generated by encoding the new value as a 4-byte `Buffer`
containing a big-endian uint32, and passing that through the [crc-32][CRC32]
library. You may also use the crc32() function from zlib.

[MT]: https://www.npmjs.com/package/mersenne-twister
[CRC32]: https://www.npmjs.com/package/crc-32

The above function signature means that the server describes how to generate the
next message and state from the current state, without specifying how to store
the update. The update must be committed atomically so that the stored messages
and the application state derived from them are consistent.
