import { Process, Mailbox, MessageType, Message } from "./index";

export function _start(): void {
  trace("Testing GC!");
  
  for (let i = 0; i < 100; i++) {
    Process.inherit_spawn<i32>((mb: Mailbox<i32>) => {
      let msg = mb.receive();
      trace("received:", 1, <f64>msg.value);
    });
    trace("Hit")
  }
  __collect();
  while (true) {}
}
