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

Finally, import Wasi into your module entry point.

```ts
// assembly/index.ts
import "wasi";
import * as lunatic from "lunatic";
```

# Channels

Sending messages back and forth between threads uses `Channel` objects.

```ts
// importing wasi will automatically create a _start method
import "wasi";
import { Channel } from "lunatic";

// create a channel
let workChannel = Channel.create<StaticArray<u8>>(0);

// send some work
workChannel.send([1, 2, 3, 4]);
workChannel.send([5, 6, 7, 8]);
workChannel.send([9, 10, 11, 12]);

Thread.start<Channel<StaticArray<u8>>>(workChannel, (workChannel: Channel<StaticArray<u8>>) => {
  workChannel.receive(); // [1, 2, 3, 4]
  workChannel.receive(); // [5, 6, 7, 8]
  workChannel.receive(); // [9, 10, 11, 12]
});
```
