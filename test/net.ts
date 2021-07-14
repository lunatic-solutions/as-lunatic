// import "wasi";
import { TCPServer, TCPStream, Process } from "../assembly";

export function _start(): void {
  let server = TCPServer.bind([127, 0, 0, 1], 10000).value!;

  let p = Process.spawn(0, (val: i32) => {
    let socket = TCPStream.connect([127, 0, 0, 1], 10000).value!;
    socket.writeBuffer([1, 2, 3, 4]);
    assert(socket.read().value);
    socket.drop();
  });
  let socket = server.accept().value!;
  let buff = socket.read().value!;
  assert(memory.compare(
    changetype<usize>(buff),
    changetype<usize>([1, 2, 3, 4] as StaticArray<u8>),
    4,
  ) == 0);
  assert(socket.writeBuffer([1]).value);
  server.drop();
  assert(p.join());
  server.drop();
  console.log("[Pass] Server created, sent data, then closed.");
}
