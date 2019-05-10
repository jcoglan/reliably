# Reliable message streaming

This project is implemented as a server in Node.js and a client in Ruby.


## Server

To run the server, first install the dependencies and then run `bin/server` with
a port number.

    $ cd server
    $ npm install
    $ ./bin/server 3000

To run the server tests:

    $ npm test

The server implements both stateless and stateful variants as a single service.


## Client

To run the client, there are no dependencies other than having Ruby installed.
The `bin/client` program takes three options:

- `-p`, the port number to connect to
- `-m`, the mode to run the client in:
  - `sum` requests a stateless stream and prints the sum of the messages
  - `crc` requests a stateful stream and prints the checksum
- `-n`, the number of messages to request; this is required for the `sum` mode
  and optional for `crc` mode

For example:

    $ cd client
    $ ./bin/client -p 3000 -m sum -n 10

To run the client tests:

    $ rake test

This includes a long-running test that starts the server and attempts to
validate a stateful stream, using a TCP client that randomly injects connection
failures and latency.
