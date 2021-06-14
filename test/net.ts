// import "wasi";
import { TCPServer, TCPStream, Process } from "../assembly";

export function _start(): void {
  let server = TCPServer.bind([127, 0, 0, 1], 10000)!;

  let p = Process.spawn(0, (val: i32) => {
    let socket = TCPStream.connect([127, 0, 0, 1], 10000)!;
    socket.writeBuffer([1, 2, 3, 4]);
    assert(socket.read());
    socket.drop();
  });
  let socket = server.accept()!;
  let buff = socket.read()!;
  assert(memory.compare(
    changetype<usize>(buff),
    changetype<usize>([1, 2, 3, 4]),
    4,
  ) == 0);
  socket.writeBuffer([1]);
  server.close();
  assert(p.join());
  server.close();
  console.log("[Pass] Server created, sent data, then closed.");
}
