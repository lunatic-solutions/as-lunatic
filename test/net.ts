// import "wasi";
import { TCPServer } from "net";

export function _start(): void {
  let server = TCPServer.bind([127, 0, 0, 1], 10000)!;
  server.close();
  console.log("[Pass] Server created and closed.");
}
