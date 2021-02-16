# as-lunatic

Instructions for use:

First, install `assemblyscript`, and `as-lunatic`.

```
npm install --save-dev assemblyscript as-lunatic
```

Then, install [lunatic](https://github.com/lunatic-solutions/lunatic).

Next, modify your asconfig to include as-lunatic as a `lib`. If the `lib` option already exists, add it to the array.

```json
{
  "options": {
    "lib": ["./node_modules/as-lunatic/assembly"]
  }
}
```

Finally, import wasi into your module entry point.

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

// send some work
let work = Channel.create(0);

// create a channel
work.send([1, 2, 3, 4]);
work.send([5, 6, 7, 8]);
work.send([9, 10, 11, 12]);

let workChannelToken: u64 = work.serialize();

Thread.start<u64>(workChannelToken, (token: u64) => {
  let workChannel = Channel.deserialize(token);
  workChannel.receive(); // [1, 2, 3, 4]
  workChannel.receive(); // [5, 6, 7, 8]
  workChannel.receive(); // [9, 10, 11, 12]
});
```
