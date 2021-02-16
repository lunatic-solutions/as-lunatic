import { Console } from "as-wasi";
import {Channel} from "../assembly/lunatic";

export function _start(): void {
    let c = Channel.create(0);
    let message = StaticArray.fromArray<u8>([137,42]);
    c.send(message);
    let result  = c.receive();
    if (result != null) {
        Console.log("Received: " + result.toString());
    }
    
}

function abort(
    message: string | null,
    fileName: string | null,
    lineNumber: u32,
    columnNumber: u32
): void
{
    // Nothing to do
}