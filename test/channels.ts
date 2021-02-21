import "wasi";
import { Console } from "as-wasi";
import { Channel } from "lunatic";
import { getIP, tryParseIPV4 } from "../assembly/lunatic-util/string";

const data = [137, 42, 123, 86, 34, 72, 21] as StaticArray<u8>;

// create an unbounded channel
let c = Channel.create();
// send some data
c.send(data);
// runtime assertion that the reference comes back
let result  = c.receive()!;

// assert the length and values of the data is correct
assert(data.length == result.length);
for (let i = 0; i < data.length; i++) {
    assert(data[i] == result[i]);
}
Console.log("[Pass] Basic Send/Receive\r\n");
