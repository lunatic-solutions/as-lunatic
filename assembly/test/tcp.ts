import "wasi";
import { tryParseIPV4, getIP, TCPServer } from "..";


const host = "192.168.1.100:1234";
let a = tryParseIPV4(changetype<usize>(host), <usize>(host.length << 1));
assert(a);
let ip = getIP(false);
assert(ip.bytes[0] == 192);
assert(ip.bytes[1] == 168);
assert(ip.bytes[2] == 1);
assert(ip.bytes[3] == 100);
assert(ip.port == 1234)
console.log("[pass] parse a typical v4 IP address");

let server = TCPServer.bind([127, 0, 0, 1], 10000)!;
server.close();
trace("server created.");
