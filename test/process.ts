import "wasi";
import { Process, Channel } from "lunatic";
import { Console } from "as-wasi";

<<<<<<< HEAD
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
=======
// @ts-ignore
@external("lunatic", "spawn_with_context")
declare function spawn_with_context(callback: u32, ptr: usize, size: usize): u32;
// @ts-ignore
@external("lunatic", "join")
declare function join(pid: u32): u32;

let closure = (): void => {
  Console.log("Hello thread!\r\n");
};
let table_index = load<u32>(<u32>changetype<usize>(closure));
let pid = spawn_with_context(table_index, 0, 0);
>>>>>>> 74ba5596157cf886737373b4513ba474fef71219

// assert(p.join());
p.join();
let b = numbers.receive()!;
assert(b.length == 1); // assertion fails, because it receives the first reference
assert(b[0] == 42);
Console.log("[Pass] Simple thread with channel pass");
