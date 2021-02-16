import "wasi";
import { Console } from "as-wasi";
import { Channel } from "../assembly/lunatic";
const data = [137, 42, 123, 86, 34, 72, 21] as StaticArray<u8>;

let c = Channel.create(0);
c.send(data);
let result  = c.receive()!;

for (let i = 0; i < data.length; i++) {
    assert(data[i] == result[i]);
}
if (result != null) {
    Console.log("Received: " + result.toString());
}
