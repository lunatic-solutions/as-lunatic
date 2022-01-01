# as-lunatic

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

Import a lunatic library.

```ts
// assembly/index.ts
import * as lunatic from "as-lunatic";
```

Finally, export a `_start()` function so that the main thread knows what function to execute when lunatic starts up.

> Note: any code that does not reside in the _start() method will execute every time a new `Process` is created.

## Process

To create another process and make work happen in parallel, use a `Process` object.

A simple process might look like this:

```ts
import { Process } from "as-lunatic";

// Test simple process
let simpleValueProcess = Process.inheritSpawnWith<i32, i32>(42, (val: i32, mb: Mailbox<i32>) => {
  assert(val == 42);
  // we expect a data message
  let message = mb.receive();
  assert(message.type == MessageType.Data);
  assert(message.value == 120);
});

assert(simpleValueProcess.value);
// send a value to the child process.
simpleValueProcess.value!.send(120);
```

Lunatic will create another `Process`, instantiate the current WebAssembly module on it, and execute the callback with a tiny bit of overhead. Under the hood, the value passed to `Process.inheritSpawnWith()` will be serialized using `ASON` which is a serialization algorithm designed just for AssemblyScript references.

To receive messages on this process, use the `Mailbox<TMessage>` parameter

## TCP Servers

To open a TCP server, use the net module.

```ts
import { TCPServer, TCPStream } from "as-lunatic";

function processSocket(socket: TCPStream, mailbox: Mailbox<i32>): void {
  // do something with the accepted tcp socket here
}

export function _start(): void {
  // bind the server to an ip address and a port
  let server = TCPServer.bindIPv4([127, 0, 0, 1], TCP_PORT);

  let stream: TCPStream;
  // blocks until a socket is accepted
  while (stream = server.accept()) {
    // pass the socket off to another process
    Process.spawnInheritWith<TCPStream, i32>(stream, processSocket);
  }
}
```

To open a TCP connection to another server, use a `TCPSocket`.

```ts
import { TCPStream } from "net";

export function _start(): void {
  let stream = TCPStream.connectIPV4([192, 168, 1, 1], PORT);
  let timeout = 0;
  
  // socket.read() blocks until bytes are read
  while (true) {
    // returns a result type, with no timeout, blocks the current thread
    let result = stream.read(timeout);
  
    if (result.type == TCPResultType.Success) {
      // read the stream.buffer property for the incoming data
      let buffer = stream.buffer;
      // echo the socket
      stream.writeStaticArray(buffer);
    } else if (result.type == TCPResultType.Timeout) {
      // the read request timed out, not the socket
      continue;
    } else if (result.type == TCPResultType.Error) {
      // the socket was closed because of error
      break;
    } else {
      // the socket was closed normally TCPResultType.Closed
      break;
    }
    stream.writeBuffer(buffer);
  }
}
```

It's also possible to resolve an IP address from a domain.

```ts
import { resolve } from "as-lunatic";

export function _start(): void {
  // blocks thread execution
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
