import "wasi";
import { Process, Channel } from "lunatic";
import { Console } from "as-wasi";

let numbers = Channel.create(0);
numbers.send([0, 1, 2]);

let p = Process.spawn<u64>(numbers.serialize(), (val: u64) => {
  let numbers = Channel.deserialize(val);
  let a = numbers.receive()!;
  assert(a.length == 3);
  assert(a[0] == 0);
  assert(a[1] == 1);
  assert(a[2] == 2);
  numbers.send([42]);
});

assert(p.join());
let b = numbers.receive()!;
assert(b.length == 1);
assert(b[0] == 42);
Console.log("[Pass] Simple thread with channel pass");
