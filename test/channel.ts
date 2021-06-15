import { Channel } from "../assembly";

class Vec3 {
    constructor(
        public x: f32,
        public y: f32,
        public z: f32,
    ) {}
}

export function _start(): void {
    let a = new Vec3(3.14, 100, 99);
    // create an unbounded channel
    let c = Channel.create<Vec3>();
    // send some data
    c.send(a);
    // runtime assertion that the reference comes back
    assert(c.receive());

    // obtain it
    let result = c.value;

    // assert the returned reference is correct
    assert(result.x == a.x);
    assert(result.y == a.y);
    assert(result.z == a.z);
    console.log("[Pass] Basic Send/Receive");
}
