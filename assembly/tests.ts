import {
  SharedMap,
  IPAddress,
  TCPServer,
  TCPSocket,
  Process,
  Mailbox,
  NetworkResultType,
  MessageType,
  Held,
  Box,
  Yieldable,
  YieldableContext,
  Maybe,
  MaybeCallbackContext
} from "./index";

export function _start(): void {
  Process.dieWhenLinkDies = false;
  testTrace();
  testSpawnInheritWith();
  testTcp();
  testHeld();
  testMaybe();
  testSharedMap();
  testYieldable();
}


function testTrace(): void {
  trace("foo");
  trace("bar", 1, 123);
  trace("baz", 456, 1, 2, 3, 4, 5);
  trace("qux", -789);
}

function testSpawnInheritWith(): void {
  let process = Process.inheritSpawnWith<i32, i32>(42, (value: i32, mb: Mailbox<i32>): void => {
    assert(value == 42);
    let message = mb.receive();
    assert(message.type == MessageType.Data);
  }).expect();
  process.send(41);
}

let port: u16 = 0xA000;
function testTcp(): void {
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

export function testSharedMap(): void {
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
      assert(map.get(key) == value);
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

export function testHeld(): void {
  for (let i = 0; i < 25; i++) {
    let heldValue = i;
    let held = Held.create<i32>(heldValue);
    for (let j = 0; j < 100;j++) {
      held.setValue(held.getValue().expect().value + 1);
      heldValue++;
      assert(held.getValue().expect().value == heldValue)
    }
    held.execute(0, (value: i32) => {
      assert(value == 0);
    });
    Process.inheritSpawnWith<Held<i32>, i32>(held, (held: Held<i32>, mb: Mailbox<i32>) => {
      let value = mb.receive().unbox();
      assert(held.getValue().expect().value = value);
    }).expect().send(heldValue);
  }
  trace("Finished held");
}

export function testMaybe(): void {
  for (let i = 0; i < 25; i++) {
    let maybe = Maybe.resolve<i32, i32>(42)
      .then<i32, i32>((value: Box<i32> | null, ctx: MaybeCallbackContext<i32, i32>) => {
        assert(value);
        assert(value!.value == 42);
        ctx.reject(41);
      });

    let result = maybe.then<i32, i32>(
      (val: Box<i32> | null, ctx: MaybeCallbackContext<i32, i32>) => {
        assert(false);
      },
      (value: Box<i32> | null, ctx: MaybeCallbackContext<i32, i32>) => {
      assert(value!.value == 41);

      ctx.resolve(12345);
    }).value;

    assert(result);
    assert(result.resolved!.value == 12345);
  }
  trace("Finished maybe");
}

export function testYieldable(): void {
  let fib = new Yieldable<i32, i32>((ctx: YieldableContext<i32, i32>) => {
    let first = 0;
    let second = 1;

    ctx.yield(first);
    ctx.yield(second);

    for(;;) {
      let next = first + second;
      ctx.yield(next);
      first = second;
      second = next;
    }
  });

  let fibNums = [0, 1, 1, 2, 3, 5, 8, 13];
  for (let i = 0; i < fibNums.length; i++) {
    assert(fib.next(0).expect().value == fibNums[i])
  }
  trace("Finished yieldable");
}
