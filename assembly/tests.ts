import {
  TCPServer,
  TCPSocket,
  Process,
  Mailbox,
} from "./index";

export function _start(): void {
  test_tcp();
}

let port = 999999;
function test_tcp(): void {
  let result = TCPServer.bindIPv4([127, 0, 0, 1], port);
  if (!result.value) assert(false, result.errorString);
  let server = result.value!;
  Process.inherit_spawn<i32>((mb: Mailbox<i32>) => {
    
  });
}
