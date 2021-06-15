# as-lunatic

Instructions for use:

First, install `assemblyscript`, and `as-lunatic`.

```
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

> Note: any code that does not reside in the _start() method will execute every time a new `thread.Process` is created.

# Process

To create another process and make work happen in parallel, use a `thread.Process` object.

A simple process might look like this:

```ts
  // Test simple process
  let simpleValueProcess = Process.spawn(42, (val: i32) => {
    assert(val == 42);
  });
  // make sure the process is finished
  assert(simpleValueProcess.join());
```

Lunatic will spin up another WebAssembly instance of your wasm module and execute your callback on another thread. Under the hood, the value passed to `Process.spawn()` will be serialized using `ASON`, and everything will happen seamlessly. If more data needs to be passed between `Process`es, a `Channel` can be used to send different kinds of messages.

# Channel

To create a `Channel`, simply call `Channel.create<T>()` where `T` is an `ASON` serializable message.

```ts
import { Channel } from "as-lunatic";

export function _start(): void {
  // create a channel
  let workChannel = Channel.create<StaticArray<u8>>(0);

  // send some work
  workChannel.send([1, 2, 3, 4]);
  workChannel.send([5, 6, 7, 8]);
  workChannel.send([9, 10, 11, 12]);

  // Channels are serializable in ASON
  Thread.start(
    workChannel,
    (workChannel: Channel<StaticArray<u8>>) => {
      workChannel.receive(); // [1, 2, 3, 4]
      workChannel.receive(); // [5, 6, 7, 8]
      workChannel.receive(); // [9, 10, 11, 12]
    },
  );
}
```

# TCP

To open a TCP server, use the net module.

```ts
import { TCPServer, TCPStream } from "as-lunatic";

// bind the server to an ip address and a port
let server = TCPServer.bind([127, 0, 0, 1], TCP_PORT);


function processSocket(socket: TCPStream): void {
  // do something with the accepted tcp socket here
}

let stream: TCPStream;

// blocks until a socket is accepted
while (stream = server.accept()) {
  // pass the socket off to another process
  Thread.start<TCPStream>(stream, processThisStream);
  stream.drop(); // when passing a stream off to another process, always drop it
}
```

To open a TCP connection, use a `TCPSocket`.

```ts
import { TCPStream } from "net";

let stream = TCPStream.connect([192, 168, 1, 1], PORT);
let buffer: StaticArray<u8>;

// socket.read() blocks until bytes are read
while (buffer = stream.read()) {
  // echo the result back to the socket until it's closed
  stream.writeBuffer(buffer);
}
```

It's also possible to resolve an IP address from a domain.

```ts
import { resolve } from "as-lunatic";
// blocks thread execution
let ip: StaticArray<u8> = resolve("mydomain.com");
```
# License

```
The MIT License (MIT)
Copyright © 2021 Joshua Tenner and Bernard Kolobara

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the “Software”), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED “AS IS”, WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
```