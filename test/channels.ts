import "wasi";
import { Console } from "as-wasi";
import { Channel } from "lunatic";

const data = [137, 42, 123, 86, 34, 72, 21] as StaticArray<u8>;

// create an unbounded channel
let c = Channel.create();
// send some data
c.send(data);
// runtime assertion that it comes back
let result  = c.receive()!;

for (let i = 0; i < data.length; i++) {
    assert(data[i] == result[i]);
}
Console.log("[Pass] Basic Send/Receive\r\n");
