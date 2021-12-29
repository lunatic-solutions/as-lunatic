import {
  TCPServer,
  TCPSocket,
  Process,
  Mailbox,
  TCPResultType,
  MessageType,
} from "./index";

export function _start(): void {
 test_spawn_inherit_with();
}

function test_spawn_inherit_with(): void {
  let p = Process.inheritSpawnWith<i32, i32>(42, (value: i32, mb: Mailbox<i32>): void => {
    assert(value == 42);
    trace("first success!")
    let message = mb.receive();
    assert(message.type == MessageType.Data);
    trace("second success!");
  });
  assert(p.value);
  p.value!.send(41);
}


let port: u16 = 0xA000;
function test_tcp(): void {
  let result = TCPServer.bindIPv4([127, 0, 0, 1], port);
  if (!result.value) assert(false, result.errorString);
  let server = result.value!;
  let p = Process.inheritSpawn<TCPSocket>((mb: Mailbox<TCPSocket>): void => {
    let socket = mb.receive().value;
    assert(socket);
    assert(socket.read() === TCPResultType.Success);
  });
  assert(p.value);
  TCPSocket.connectIPV4([127, 0, 0, 1], port).value!.writeUnsafe(
    changetype<usize>([1, 2, 3, 4] as StaticArray<u8>),
    4,
  );
  let inbound = server.accept();
  assert(inbound.value);
  p.value!.send(inbound.value!);
}
