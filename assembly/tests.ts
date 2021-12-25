import {
  TCPServer,
  TCPSocket,
  Process,
  Mailbox,
} from "./index";

export function _start(): void {
  for (let  i = 0; i < 1000; i ++) {
    Process.inherit_spawn<i32>((mb: Mailbox<i32>) => {
    
    });
  }
  __collect();
}

let port: u16 = 0xA000;
function test_tcp(): void {
  let result = TCPServer.bindIPv4([127, 0, 0, 1], port);
  if (!result.value) assert(false, result.errorString);
  let server = result.value!;
  
}
