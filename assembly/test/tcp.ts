// import "wasi";
import { TCPServer } from "..";

export function _start(): void {
  let server = TCPServer.bind([127, 0, 0, 1], 10000)!;
  server.close();
  trace("[Pass] Server created and closed.");
}
