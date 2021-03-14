import { Process } from "thread";
import { Channel } from "channel";

class Vec3 {
  constructor(
    public x: f32,
    public y: f32,
    public z: f32,
  ) {}
}

export function _start(): void {
  // Test simple process
  let simpleValueProcess = Process.spawn(42, (val: i32) => {
    assert(val == 42);
  });
  assert(simpleValueProcess.join());
  console.log("[Pass] Thread with simple value");

  let numbers = Channel.create(0);
  numbers.send([0, 1, 2] as StaticArray<u8>);

  let p = Process.spawn<u64>(numbers.serialize(), (val: u64) => {
// let p = Process.spawn<u64>(0, (val: u64) => {
    let numbers = Channel.deserialize(val);
    let a = numbers.receive()!;
    assert(a.length == 3);
    assert(a[0] == 0);
    assert(a[1] == 1);
    assert(a[2] == 2);
    numbers.send([42]);
  });

  assert(p.join());
  let b = numbers.receive()!;
  assert(b.length == 1);
  assert(b[0] == 42);
  console.log("[Pass] Simple thread with channel pass\n");

  let vector = new Vec3(1, 2, 3);
  let vecProcess = Process.spawn<Vec3>(vector, (vec: Vec3) => {
    assert(vec.x == 1);
    assert(vec.y == 2);
    assert(vec.z == 3);
  });
  assert(vecProcess.join());
  console.log("[Pass] Thread with flat reference");


  let arrayProcess = Process.spawn<Array<f32>>([24, 6, 9], (val: Array<f32>) => {
    assert(val[0] == 24);
    assert(val[1] == 6);
    assert(val[2] == 9);
  });
  assert(arrayProcess.join());
  console.log("[Pass] Thread with array");

  let typedArray = new Uint32Array(3);
  typedArray[0] = 1000;
  typedArray[1] = 255;
  typedArray[2] = 9001;

  let typedArrayProcess = Process.spawn<Uint32Array>(typedArray, (val: Uint32Array) => {
    assert(val[0] == 1000);
    assert(val[1] == 255);
    assert(val[2] == 9001);
  });
  assert(typedArrayProcess.join());
  console.log("[Pass] Thread with typedarray");

  // inlined static memory segment
  let staticArray = [300, 1000, -42] as StaticArray<i16>;
  let staticArrayProcess = Process.spawn(staticArray, (val: StaticArray<i16>) => {
    assert(val[0] == 300);
    assert(val[1] == 1000);
    assert(val[2] == -42);
  });
  assert(staticArrayProcess.join());
  console.log("[Pass] Thread with static staticarray segment");

  // dynamic allocation static array
  let allocatedStaticArray = new StaticArray<u8>(5);
  for (let i = 0; i < 5; i++) allocatedStaticArray[i] = <u8>i;

  let allocatedStaticArrayProcess = Process.spawn(allocatedStaticArray, (val: StaticArray<u8>) => {
    for (let i = 0; i < 5; i++) assert(val[i] == <u8>i);
  });
  assert(allocatedStaticArrayProcess.join());
  console.log("[Pass] Thread with allocated staticarray segment");
}
