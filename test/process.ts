// import "wasi";
// import { Process, Channel } from "lunatic";
// import { Console } from "as-wasi";
// 
// let numbers = Channel.create(0);
// numbers.send([0, 1, 2]);
// 
// let p = Process.spawn<u64>(numbers.serialize(), (val: u64) => {
//   // This line doesn't apper to be called
//   Console.log("Testing!\r\n");
// });
// Process.sleep(1000);
// Console.log(p.join().toString() + "\r\n");
// let result = numbers.receive()!;
// Console.log(result.toString() + "\r\n");
// result = numbers.receive()!;
// assert(result[0] === 42);
// Console.log("Success!");
import { Console } from "as-wasi";
import "wasi";

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

Console.log("Pid: " + pid.toString());
join(pid);