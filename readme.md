# as-lunatic

## Getting Started

Instructions for use:

First, install `assemblyscript`, and `as-lunatic`.

```sh
npm install --save-dev assemblyscript as-lunatic
```

Then, install [lunatic](https://github.com/lunatic-solutions/lunatic).

Next, modify your asconfig to extend as-lunatic,

```json
{
  "extends": "as-lunatic/asconfig.json"
}
```

Import the `as-lunatic` library. This library will provide a couple of globals including implementations for `abort`, `trace`, `__finalize`, and a few other functions.

```ts
// assembly/index.ts
import * as lunatic from "as-lunatic";
```

Finally, export a `_start()` function from the entry file, so that the main thread knows what function to execute when lunatic starts up.

> Note: any code that does not reside in the _start() method will execute every time a new `Process` is created.

## Errors

Lunatic errors are represented by an id. They *must* be freed after creation, so `as-lunatic` will bundle it's function return types in a `Result<T>` class. This allows for lunatic errors to be managed by `as-disposable`, and helps prevent memory leaks. For example, when accepting a `TcpStream` from a `TcpListener`, it's possible to check to see if the `TcpListener` is in an errored state.

```ts
export function _start(): void {
  // bind a tcp server and expect it to open
  let server = TCPServer.bindIPv4([127, 0, 0, 1], 10000).expect()!;
  while (true) {
    // accept sockets forever
    let socketResult = server.accept(); // this is a Result<TCPSocket | null>
    if (socketResult.isOk()) {
      // we can now use this socket resource
      let socket = socketResult.expect()!;
    } else {
      // we can log out the error
      trace(socketResult.errorString);
    }
  }
}
```

Results must be unpacked

## Process

To create another process and make work happen in parallel, use the static `Process` class methods.

A simple process might look like this:

```ts
import { Process } from "as-lunatic";

export function _start(): void {
  // inheritSpawn creates a process with the given callback that accepts a mailbox
  Process.inheritSpawn<i32>((malibox: Mailbox<i32>): void => {
    trace("Hello world!");
  });
}
```

It's possible to send messages to processes. Mailboxes are message receivers.

```ts
import { Process } from "as-lunatic";

export function _start(): void {
  // create a process, and unpack it
  let simpleValueProcess = Process.inheritSpawn<i32>((mb: Mailbox<i32>) => {
    // we expect to receive a message. This function call blocks until it receives a message
    let message = mb.receive();
    // we assume the message type will be a Data message, and the value will be 42
    assert(message.type == MessageType.Data);
    assert(message.value == 42);
  }).expect()!;

  // send a value to the child process.
  simpleValueProcess.send(42);
}
```

Lunatic will create another `Process`, instantiate the current WebAssembly module on it, and execute the callback with a tiny bit of overhead. `as-lunatic` will use `ASON` to transfer and serialize messages sent to child processes.


## TCP Servers

To open a TCP server, use the static methods on the `TCPServer` class.

```ts
import { TCPServer, TCPStream } from "as-lunatic";

function processSocket(socket: TCPStream, mailbox: Mailbox<i32>): void {
  // do something with the accepted tcp socket here on another thread
}

export function _start(): void {
  // bind the server to an ip address and a port
  let server = TCPServer.bindIPv4([127, 0, 0, 1], TCP_PORT);

  // blocks until a socket is accepted
  while (true) {
    let socket = server.accept().expect()!;W
    // pass the socket off to another process
    Process.spawnInheritWith<TCPSocket, i32>(stream, processSocket);
  }
}
```

To open a TCP connection to another server, use a `TCPSocket` connection.

```ts
import { TCPSocket, TCPResultType } from "as-lunatic";

export function _start(): void {
  // connect to an ip and a port
  let connection = TCPSocket.connectIPv4(ipAddress, port).expect()!;

  // send a message using a write method
  let result = socket.writeBuffer(String.UTF8.encode("Hello world!"));

  // returns a `Result<TCPResultType>`
  switch (result.value) {
    case TCPResultType.Error: {
      trace(result.errorString);
      break;
    }
    case TCPResultType.Closed: {
      trace("Socket closed");
      break;
    }
    case TCPResultType.Success: {
      // bytes written is stored on byteCount
      trace("Bytes Written", 1, <f64>socket.byteCount);
      break;
    }
  }
}
```

It's also possible to resolve an IP address from a domain.

```ts
import { resolve } from "as-lunatic";

export function _start(): void {
  // obtain an array of IPAddress objects
  let ips: IPAddress[] = resolve("mydomain.com");
}
```

## License

```txt
The MIT License (MIT)
Copyright © 2021 Joshua Tenner and Bernard Kolobara

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the “Software”), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED “AS IS”, WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
```
