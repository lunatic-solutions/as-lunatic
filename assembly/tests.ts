import { Process, Mailbox, MessageType, Message } from "./index";

export function _start(): void {
  trace("Hello world!");
  let p = Process.inherit_spawn<i32[]>((mb: Mailbox<i32[]>) => {
    trace("process running");
    let data = mb.receive([], 0);
    assert(data.type == MessageType.Data);
    let value = data.value.reduce((a: i32, b: i32) => a + b, 0);
    trace("value is", 1, <f64>value);
  });

  if (!p.value) trace(p.errorString);
  else {
    let process = p.value!;
    process.send([1, 2, 3, 4]);
    while(true) {};
  }
}
