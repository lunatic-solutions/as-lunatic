import {
  SharedMap,
  IPAddress,
  TCPServer,
  TCPSocket,
  Process,
  Mailbox,
  maybe,
  MaybeContext,
  MessageType,
  NetworkResultType,
} from "./index";
import { Box } from "./process/util";

export function _start(): void {
 test_spawn_inherit_with();
 test_tcp();
 // test_shared_map();
 test_maybe();
}

function test_spawn_inherit_with(): void {
  let process = Process.inheritSpawnWith<i32, i32>(42, (value: i32, mb: Mailbox<i32>): void => {
    assert(value == 42);
    trace("first success!")
    let message = mb.receive();
    assert(message.type == MessageType.Data);
    trace("second success!");
  }).expect();
  process.send(41);
}

let port: u16 = 0xA000;
function test_tcp(): void {
  let address = IPAddress.v4([127, 0, 0, 1], port);
  let server = TCPServer.bind(address).expect();
  let process = Process.inheritSpawn<TCPSocket>((mailbox: Mailbox<TCPSocket>): void => {
    let message = mailbox.receive();
    let socket = message.unbox();
    let buffer: u8[] = [5, 6, 7, 8];

    socket.write(buffer);
    assert(socket.read(buffer).type === NetworkResultType.Success);
    assert(buffer[0] == 1);
    assert(buffer[1] == 2);
    assert(buffer[2] == 3);
    assert(buffer[3] == 4);

    message.reply<u8>(0);
  }).expect();
  let socket = TCPSocket.connect(address).expect();
  let inbound = server.accept().expect();

  let buffer: u8[] = [1, 2, 3, 4];
  socket.write(buffer);
  process.request<TCPSocket, u8>(inbound);

  assert(socket.read(buffer).type === NetworkResultType.Success);
  assert(buffer[0] == 5);
  assert(buffer[1] == 6);
  assert(buffer[2] == 7);
  assert(buffer[3] == 8);
}

class TaskContext {
  constructor(
      public readonly map: SharedMap<string>,
      public readonly task: (map: SharedMap<string>) => void
  ) {}
}

function createTask(map: SharedMap<string>, task: (map: SharedMap<string>) => void): void {
  const ctx = new TaskContext(map, task)
  const process = Process.inheritSpawnWith<TaskContext, u8>(ctx, (ctx: TaskContext, mailbox: Mailbox<u8>) => {
      const message = mailbox.receive()
      assert(message.type == MessageType.Data)
      ctx.task(ctx.map)
      message.reply<u8>(0)
  }).expect()

  process.request<u8, u8>(0)
}

export function test_shared_map(): void {
  const map = new SharedMap<string>()

  map.set("abc", "def")
  createTask(map, (map: SharedMap<string>): void => {
      assert(map.get("abc") == "def")
      map.set("xyz", "123")
      assert(map.get("xyz") == "123")
  })
  assert(map.size == 2)

  const keys = map.keys()
  const values = map.values()
  for (let i = 0; i < map.size; i++) {
      const key = unchecked(keys[i])
      const value = unchecked(values[i])
      assert(map.get(key) == value)
      trace(`SharedMap: ${key}: ${value}`)
  }

  assert(map.has("abc"))
  map.delete("abc")
  assert(!map.has("abc"))
  map.delete("foo")
  createTask(map, (map: SharedMap<string>): void => {
      assert(map.has("xyz"))
      assert(!map.has("abc"))
      map.clear()
  })
  assert(!map.has("xyz"))
  assert(!map.size)
}

export function test_maybe(): void {
  for (let i = 0; i < 1000;i++) {
    maybe<i32, i32>(
      (ctx: MaybeContext<i32, i32>) => {
        ctx.resolve(42);
      }
    ).then<u64, u64>(
      (box: Box<i32> | null, ctx: MaybeContext<u64, u64>) => {
        trace("resolved to", 1, <f64>box!.value);
        ctx.reject(41);
      }
    ).then<u64, u64>(
      (box: Box<u64> | null, ctx: MaybeContext<u64, u64>) => {
        assert(false, "Cannot resolve maybe");
      },
      (box: Box<u64> | null, ctx: MaybeContext<u64, u64>) => {
        trace("rejected to", 1, <f64>box!.value);
      }
    );
  }
  __collect();
  Process.sleep(10000);
}
