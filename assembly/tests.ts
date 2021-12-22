import { Process, Mailbox, MessageType, Message } from "./index";

export function _start(): void {
  trace("Testing GC!");
  let array = [] as Process<i32>[];

  for (let i = 0; i < 100; i++) {
    let p = Process.inherit_spawn<i32>((mb: Mailbox<i32>) => {
      let msg = mb.receive();
      trace("received:", 1, <f64>msg.value);
    });
    array.push(p.value!);
    p.value!.send(i);
  }
  __collect();
  while (true) {}
}
