import "wasi";
import { Console } from "as-wasi";

// @ts-ignore: valid decorator
@external("lunatic", "spawn_with_context")
declare function spawn_with_context(
  func: u32,
  buf_ptr: usize,
  buf_len: usize,
): u32;

const enum ChannelReceiveResult {
  Success = 0,
  Fail = 1,
}

const enum ChannelReceivePrepareResult {
  Success = 0,
  Fail = 1,
}

const enum JoinResult {
  Success = 0,
  Fail = 1,
}

// @ts-ignore: valid decorator here
@external("lunatic", "channel_receive_prepare")
declare function channel_receive_prepare(channel: u32, rec: usize): ChannelReceivePrepareResult;


export class BoxWithCallback<T> {
  constructor(
    public callback: i32 = -1,
    // @ts-ignore: T will always be a number value
    public value: T = 0,
  ) {}
}

const receive_length_pointer = memory.data(sizeof<u32>());
const CHANNEL_INITIAL_PAYLOAD = 0;

// @ts-ignore: valid decorator here
@external("lunatic", "channel_receive")
declare function channel_receive(buffer: usize, length: usize): ChannelReceiveResult;

// @ts-ignore: valid decorator
@external("lunatic", "join")
declare function join(pid: u32): JoinResult;

class Process {
  _pid: u32 = 0;

  public static spawnWithBox<T>(val: T, callback: (val: T) => void): Process {
    let box = new BoxWithCallback<T>(callback.index, val);
    Console.log("It ran\r\n");
    let threadCallback = (): void => {
      Console.log("I'm running on another thread.\r\n");
      let box = new BoxWithCallback<T>();
      // Get the payload from channel 0
      let prepareResult = channel_receive_prepare(CHANNEL_INITIAL_PAYLOAD, receive_length_pointer);

      // get the payload length and assert it's the correct size
      let length = load<u32>(receive_length_pointer);
      if (prepareResult == ChannelReceivePrepareResult.Fail) return;
      assert(length == offsetof<BoxWithCallback<T>>());

      // obtain the static segment, callback, and val
      channel_receive(changetype<usize>(box), length);

      assert(box.callback != -1);
      // start the thread
      call_indirect(box.callback, box.value);
    };
    // send the box to the new thread
    Console.log("It created\r\n");
    let pid = spawn_with_context(
      threadCallback.index,
      changetype<usize>(box),
      // packed message is the size of T + usize
      offsetof<BoxWithCallback<T>>(),
    );
    let t = new Process();
    t._pid = pid;
    Console.log(t._pid.toString() + "\r\n");
    // Console.log("It's running.\r\n");
    return t;
  }

  public join(): bool {
    return join(this._pid) == JoinResult.Success;
  }
}

let simpleValueProcess = Process.spawnWithBox(42, (val: i32) => {
  assert(val == 42);
});
assert(simpleValueProcess.join());
// Console.log("[Pass] Thread with simple value\r\n");



// let numbers = Channel.create(0);
// numbers.send([0, 1, 2] as StaticArray<u8>);

//let p = Process.spawn<u64>(numbers.serialize(), (val: u64) => {
// let p = Process.spawn<u64>(0, (val: u64) => {
  // Console.log("It ran!");
  // let numbers = Channel.deserialize(val);
  // let a = numbers.receive()!;
  // assert(a.length == 3);
  // assert(a[0] == 0);
  // assert(a[1] == 1);
  // assert(a[2] == 2);
  // numbers.send([42]);
// });
// 
// assert(p.join());
// let b = numbers.receive()!;
// assert(b.length == 1);
// assert(b[0] == 42);
// Console.log("[Pass] Simple thread with channel pass\n");
// 
// class Vec3 {
//   constructor(
//     public x: f32,
//     public y: f32,
//     public z: f32,
//   ) {}
// }
// 
// let vector = new Vec3(1, 2, 3);
// 
// let vecProcess = Process.spawn<Vec3>(vector, (vec: Vec3) => {
//   assert(vec.x == 1);
//   assert(vec.y == 2);
//   assert(vec.z == 3);
// });
// assert(vecProcess.join());
// Console.log("[Pass] Thread with flat reference\r\n");
// 
// 
// let arrayProcess = Process.spawn<Array<f32>>([24, 6, 9], (val: Array<f32>) => {
//   assert(val[0] == 24);
//   assert(val[1] == 6);
//   assert(val[2] == 9);
// });
// assert(arrayProcess.join());
// Console.log("[Pass] Thread with array\r\n");
// 
// let typedArray = new Uint32Array(3);
// typedArray[0] = 1000;
// typedArray[1] = 255;
// typedArray[2] = 9001;
// 
// let typedArrayProcess = Process.spawn<Uint32Array>(typedArray, (val: Uint32Array) => {
//   assert(val[0] == 1000);
//   assert(val[1] == 255);
//   assert(val[2] == 9001);
// });
// assert(typedArrayProcess.join());
// Console.log("[Pass] Thread with typedarray\r\n");
// 
// // inlined static memory segment
// let staticArray = [300, 1000, -42] as StaticArray<i16>;
// let staticArrayProcess = Process.spawn(staticArray, (val: StaticArray<i16>) => {
//   assert(val[0] == 300);
//   assert(val[1] == 1000);
//   assert(val[2] == -42);
// });
// assert(staticArrayProcess.join());
// Console.log("[Pass] Thread with static staticarray segment\r\n");
// 
// // dynamic allocation static array
// let allocatedStaticArray = new StaticArray<u8>(5);
// for (let i = 0; i < 5; i++) allocatedStaticArray[i] = <u8>i;
// 
// let allocatedStaticArrayProcess = Process.spawn(allocatedStaticArray, (val: StaticArray<u8>) => {
//   for (let i = 0; i < 5; i++) assert(val[i] == <u8>i);
// });
// assert(allocatedStaticArrayProcess.join());
// Console.log("[Pass] Thread with allocated staticarray segment\r\n");
// 