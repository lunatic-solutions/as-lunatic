import { random_get } from "../entry";
import { Message, Mailbox } from "../message";
import { MessageType } from "../message/util";
import { Process } from "../process";

type SharedBufferMessage = Message<SharedBufferEvent>;
// FIXME: There is likely a better way to approach the issue of efficiently removing timed-out waits.
@final
class Waits {
  public readonly nonces: Map<u64, SharedBufferMessage> = new Map();
  public readonly offsets: Map<i32, Set<u64>> = new Map();
}

@final
export class SharedBuffer {
  private self: Process<SharedBufferEvent>;

  constructor(public readonly length: i32) {
    this.self = Process.inheritSpawnWith<i32, SharedBufferEvent>(length, (length: u32, mailbox: Mailbox<SharedBufferEvent>) => {
      const buffer = new ArrayBuffer(length);
      const waits: Waits = new Waits();
      for (;;) {
        const message = mailbox.receive();
        assert(message.type == MessageType.Data);
        message.unbox().exec(buffer, message, waits);
      }
    }).expect();
  }

  send<T>(event: SharedBufferEvent, timeout: u64 = u64.MAX_VALUE): Message<T> {
    return this.self.request<SharedBufferEvent, T>(event, 0, timeout);
  }

  sendWithoutResponse<T>(event: SharedBufferEvent): void {
    this.self.send(event);
  }
}

@inline
function calculatePtr(buffer: ArrayBuffer, offset: i32): usize {
  assert(offset <= buffer.byteLength);
  return changetype<usize>(buffer) + offset;
}

abstract class SharedBufferEvent {
  abstract exec(buffer: ArrayBuffer, message: SharedBufferMessage, waits: Waits): void
}

@final
class AddSharedBufferEvent<T extends number> extends SharedBufferEvent {
  constructor(public offset: i32, public value: T) {
    super();
  }

  exec(buffer: ArrayBuffer, message: SharedBufferMessage): void {
    const offset = this.offset;
    const value = this.value;
    const ptr = calculatePtr(buffer, offset);
    const result = load<T>(ptr) + value;
    store<T>(ptr, result as T);
    message.reply<T>(result as T);
  }
}

@final
class AndSharedBufferEvent<T extends number> extends SharedBufferEvent {
  constructor(public offset: i32, public value: T) {
    super();
  }

  exec(buffer: ArrayBuffer, message: SharedBufferMessage): void {
    const offset = this.offset;
    const value = this.value;
    const ptr = calculatePtr(buffer, offset);
    const result = load<T>(ptr) & value;
    store<T>(ptr, result);
    message.reply<T>(result);
  }
}

@final
class CompareExchangeSharedBufferEvent<T extends number> extends SharedBufferEvent {
  constructor(public offset: i32, public expected: T, public replacement: T) {
    super();
  }

  exec(buffer: ArrayBuffer, message: SharedBufferMessage): void {
    const offset = this.offset;
    const expected = this.expected;
    const replacement = this.replacement;
    const ptr = calculatePtr(buffer, offset);
    const result = load<T>(ptr);
    if (result == expected) {
      store<T>(ptr, replacement);
    }
    message.reply<T>(result);
  }
}

@final
class ExchangeSharedBufferEvent<T extends number> extends SharedBufferEvent {
  constructor(public offset: i32, public value: T) {
    super();
  }

  exec(buffer: ArrayBuffer, message: SharedBufferMessage): void {
    const offset = this.offset;
    const value = this.value;
    const ptr = calculatePtr(buffer, offset);
    const result = load<T>(ptr);
    store<T>(ptr, value);
    message.reply<T>(result);
  }
}

@final
class LoadSharedBufferEvent<T extends number> extends SharedBufferEvent {
  constructor(public offset: i32) {
    super();
  }

  exec(buffer: ArrayBuffer, message: SharedBufferMessage): void {
    const offset = this.offset;
    const ptr = calculatePtr(buffer, offset);
    const result = load<T>(ptr);
    message.reply<T>(result);
  }
}

@final
class NotifySharedBufferEvent extends SharedBufferEvent {
  constructor(public offset: i32, public count: i32) {
    super();
  }

  exec(buffer: ArrayBuffer, message: SharedBufferMessage, waits: Waits): void {
    const offset = this.offset;
    const offsets = waits.offsets;
    let count = 0;
    if (offsets.has(offset)) {
      const nonces = waits.nonces;
      const set = offsets.get(offset);
      const arr = set.values();
      count = max(0, min(this.count, arr.length));
      for (let i = 0; i < count; i++) {
        const nonce = unchecked(arr[i]);
        set.delete(nonce);

        // "ok"
        nonces.get(nonce).reply<u8>(0);
        nonces.delete(nonce);
      }
    }
    message.reply<i32>(count);
  }
}

@final
class OrSharedBufferEvent<T extends number> extends SharedBufferEvent {
  constructor(public offset: i32, public value: T) {
    super();
  }

  exec(buffer: ArrayBuffer, message: SharedBufferMessage): void {
    const offset = this.offset;
    const value = this.value;
    const ptr = calculatePtr(buffer, offset);
    const result = load<T>(ptr) | value;
    store<T>(ptr, result);
    message.reply<T>(result);
  }
}

@final
class StoreSharedBufferEvent<T extends number> extends SharedBufferEvent {
  constructor(public offset: i32, public value: T) {
    super();
  }

  exec(buffer: ArrayBuffer, message: SharedBufferMessage): void {
    const offset = this.offset;
    const value = this.value;
    const ptr = calculatePtr(buffer, offset);
    store<T>(ptr, value);
    message.reply<T>(value);
  }
}

@final
class SubSharedBufferEvent<T extends number> extends SharedBufferEvent {
  constructor(public offset: i32, public value: T) {
    super();
  }

  exec(buffer: ArrayBuffer, message: SharedBufferMessage): void {
    const offset = this.offset;
    const value = this.value;
    const ptr = calculatePtr(buffer, offset);
    const result = load<T>(ptr) - value;
    store<T>(ptr, result);
    message.reply<T>(result);
  }
}

@final
class WaitSharedBufferEvent<T extends number> extends SharedBufferEvent {
  constructor(public offset: i32, public value: T, public nonce: u64) {
    if (sizeof<T>() < sizeof<i32>() || !isSigned<T>() || !isInteger<T>()) {
      ERROR("Atomics.wait() only accepts 32-bit and 64-bit signed integers")
    }
    super();
  }

  exec(buffer: ArrayBuffer, message: SharedBufferMessage, waits: Waits): void {
    const offset = this.offset;
    const value = this.value;
    const nonce = this.nonce;
    const ptr = calculatePtr(buffer, offset);
    if (load<T>(ptr) !== value) {
      // "not-equal"
      message.reply<u8>(1);
      return;
    }

    const offsets = waits.offsets;
    let set: Set<u64>;
    if (offsets.has(offset)) {
      set = offsets.get(offset);
    } else {
      offsets.set(offset, set = new Set());
    }

    waits.nonces.set(nonce, message);
    set.add(nonce);

    // Do not reply yet
  }
}

@final
class RemoveWaitSharedBufferEvent<T extends number> extends SharedBufferEvent {
  constructor(public offset: i32, public nonce: T) {
    super();
  }

  exec(buffer: ArrayBuffer, message: SharedBufferMessage, waits: Waits): void {
    const offset = this.offset;
    const nonce = this.nonce;
    waits.nonces.delete(nonce);

    if (waits.offsets.has(offset)) {
      waits.offsets.get(offset).delete(nonce);
    }

    // No reply
  }
}

@final
class XorSharedBufferEvent<T extends number> extends SharedBufferEvent {
  constructor(public offset: i32, public value: T) {
    super();
  }

  exec(buffer: ArrayBuffer, message: SharedBufferMessage): void {
    const offset = this.offset;
    const value = this.value;
    const ptr = calculatePtr(buffer, offset);
    const result = load<T>(ptr) ^ value;
    store<T>(ptr, result);
    message.reply<T>(result);
  }
}

function assertInteger<T>(): void {
  if (!isInteger<T>()) {
    ERROR("Type must be integer");
  }
}

function calculateOffset<T extends number>(view: SharedBufferView<T>, index: i32): i32 {
  assert(index >= 0 && index < view.length);
  return view.byteOffset + index * sizeof<T>();
}

@final
export class SharedBufferView<T extends number> {
  constructor(public readonly buffer: SharedBuffer, public readonly byteOffset: i32, public readonly length: i32) {
    if (!isInteger<T>() && !isFloat<T>()) {
      ERROR("Type must be numeric");
    }
  }

  @operator("[]")
  _get(index: i32): T {
    const offset = calculateOffset(this, index);
    const event = new LoadSharedBufferEvent(offset);
    return this.buffer.send<T>(event).unbox();
  }

  @operator("[]=")
  _set(index: i32, value: T): T {
    const offset = calculateOffset(this, index);
    const event = new StoreSharedBufferEvent(offset, value);
    return this.buffer.send<T>(event).unbox();
  }

  get BYTES_PER_ELEMENT(): i32 {
    return sizeof<T>();
  }

  at(index: i32): T {
    return this._get(index < 0 ? this.length - index : index);
  }

  copyWithin(target: i32, start: i32 = 0, end: i32 = this.length): SharedBufferView<T> {
    ERROR("Not implemented yet");
    return this;
  }

  // skip entries

  every<U>(callback: (element: T, index: i32, view: this, ctx: U) => bool, ctx: U): bool {
    ERROR("Not implemented yet");
  }

  fill(value: T, start: i32 = 0, end: i32 = this.length): SharedBufferView<T> {
    ERROR("Not implemented yet");
    return this;
  }

  filter<U>(callback: (element: T, index: i32, view: this, ctx: U) => bool, ctx: U): SharedBufferView<T> {
    ERROR("Not implemented yet");
  }

  // Note: AssemblyScript doesn't implement this method, most likely because it can return undefined in JS.
  //       If this method is implemented, a fallback argument should be returned.
  find<U>(callback: (element: T, index: i32, view: this, ctx: U) => bool, ctx: U, fallback: T): T {
    ERROR("Not implemented yet");
  }

  findIndex<U>(callback: (element: T, index: i32, view: this, ctx: U) => bool, ctx: U): i32 {
    ERROR("Not implemented yet");
  }

  // Note: AssemblyScript doesn't implement this method, most likely because it can return undefined in JS.
  //       If this method is implemented, a fallback argument should be returned.
  findLast<U>(callback: (element: T, index: i32, view: this, ctx: U) => bool, ctx: U, fallback: T): T {
    ERROR("Not implemented yet");
  }

  findLastIndex<U>(callback: (element: T, index: i32, view: this, ctx: U) => bool, ctx: U): i32 {
    ERROR("Not implemented yet");
  }

  forEach<U>(callback: (element: T, index: i32, view: this, ctx: U) => void, ctx: U): void {
    ERROR("Not implemented yet");
  }

  includes(value: T, start: i32 = 0): bool {
    ERROR("Not implemented yet");
  }

  indexOf(value: T, start: i32 = 0): i32 {
    ERROR("Not implemented yet");
  }

  join(separator: string = ","): string {
    ERROR("Not implemented yet");
  }

  // skip keys

  lastIndexOf(value: T, start: i32 = this.length): i32 {
    ERROR("Not implemented yet");
  }

  map<U>(callback: (element: T, index: i32, view: this, ctx: U) => void, ctx: U): SharedBufferView<T> {
    ERROR("Not implemented yet");
  }

  reduce<U, V>(callback: (accumulator: U, element: T, index: i32, view: this, ctx: V) => U, initial: U, ctx: V): U {
    ERROR("Not implemented yet");
  }

  reduceRight<U, V>(callback: (accumulator: U, element: T, index: i32, view: this, ctx: V) => U, initial: U, ctx: V): U {
    ERROR("Not implemented yet");
  }

  reverse(): this {
    ERROR("Not implemented yet");
  }

  set(view: SharedBufferView<T>, offset: i32 = 0): void {
    ERROR("Not implemented yet");
  }

  slice(start: i32 = 0, end: i32 = this.length): SharedBufferView<T> {
    ERROR("Not implemented yet");
  }

  some<U>(callback: (element: T, index: i32, view: this) => bool, ctx: U): bool {
    ERROR("Not implemented yet");
  }

  // Note: The callback parameter should be optional with a default toString()-based comparator.
  sort<U>(callback: (a: T, b: T, ctx: U) => i32, ctx: U): SharedBufferView<T> {
    ERROR("Not implemented yet");
  }

  subarray(start: i32 = 0, end: i32 = this.length): SharedBufferView<T> {
    return new SharedBufferView<T>(
      this.buffer,
      this.byteOffset + calculateOffset(this, start),
      end - start
    );
  }

  // skip toLocaleString

  toString(): string {
    return this.join();
  }

  // skip values
}

function getNonce(): u64 {
  const nonce = memory.data(sizeof<u64>());
  const errno = random_get(nonce, sizeof<u64>());
  assert(!errno, `WASI random_get returned non-zero errno (${errno})`);
  return load<u64>(nonce);
}

export namespace Atomics {
  export function add<T extends number>(view: SharedBufferView<T>, index: i32, value: T): T {
    assertInteger<T>();
    const offset = calculateOffset(view, index);
    return view.buffer.send<T>(new AddSharedBufferEvent(offset, value)).unbox();
  }

  export function and<T extends number>(view: SharedBufferView<T>, index: i32, value: T): T {
    assertInteger<T>();
    const offset = calculateOffset(view, index);
    return view.buffer.send<T>(new AndSharedBufferEvent(offset, value)).unbox();
  }

  export function compareExchange<T extends number>(view: SharedBufferView<T>, index: i32, expected: T, replacement: T): T {
    assertInteger<T>();
    const offset = calculateOffset(view, index);
    return view.buffer.send<T>(new CompareExchangeSharedBufferEvent(offset, expected, replacement)).unbox();
  }

  export function exchange<T extends number>(view: SharedBufferView<T>, index: i32, value: T): T {
    assertInteger<T>();
    const offset = calculateOffset(view, index);
    return view.buffer.send<T>(new ExchangeSharedBufferEvent<T>(offset, value)).unbox();
  }

  export function load<T extends number>(view: SharedBufferView<T>, index: i32): T {
    assertInteger<T>();
    const offset = calculateOffset(view, index);
    return view.buffer.send<T>(new LoadSharedBufferEvent<T> (offset)).unbox();
  }

  export function notify<T extends number>(view: SharedBufferView<T>, index: i32, count: i32): i32 {
    if (!isInteger<T>() || sizeof<T>() !== 4 || !isSigned<T>()) {
      ERROR("Type must be an i32");
    }

    const offset = calculateOffset(view, index);
    return view.buffer.send<T>(new NotifySharedBufferEvent(offset, count)).unbox();
  }

  export function or<T extends number>(view: SharedBufferView<T>, index: i32, value: T): T {
    assertInteger<T>();
    const offset = calculateOffset(view, index);
    return view.buffer.send<T>(new OrSharedBufferEvent(offset, value)).unbox();
  }

  export function store<T extends number>(view: SharedBufferView<T>, index: i32, value: T): T {
    assertInteger<T>();
    const offset = calculateOffset(view, index);
    return view.buffer.send<T>(new StoreSharedBufferEvent(offset, value)).unbox();
  }

  export function sub<T extends number>(view: SharedBufferView<T>, index: i32, value: T): T {
    assertInteger<T>();
    const offset = calculateOffset(view, index);
    return view.buffer.send<T>(new SubSharedBufferEvent(offset, value)).unbox();
  }

  export function wait<T extends number>(view: SharedBufferView<T>, index: i32, value: T, timeout: i32 = i32.MIN_VALUE): string {
    const elementSize = sizeof<T>()
    if (!isInteger<T>() || !isSigned<T>() || (elementSize !== 4 && elementSize !== 8)) {
      ERROR("Type must be an i32 or i64")
    }

    const offset = calculateOffset(view, index);
    const nonce = getNonce();
    const result = view.buffer.send<u8>(
      new WaitSharedBufferEvent(offset, value, nonce),
      timeout == i32.MIN_VALUE
        ? u64.MAX_VALUE
        : max(0, timeout)
    );

    if (result.type == MessageType.Timeout) {
      view.buffer.sendWithoutResponse(new RemoveWaitSharedBufferEvent(offset, nonce));
      return "timed-out";
    }

    if (result.unbox()) {
      return "not-equal";
    }

    return "ok";
  }

  export function xor<T extends number>(view: SharedBufferView<T>, index: i32, value: T): T {
    assertInteger<T>();
    const offset = calculateOffset(view, index);
    return view.buffer.send<T>(new XorSharedBufferEvent(offset, value)).unbox();
  }

  export function isLockFree(bytesPerElement: i32): bool {
    switch (bytesPerElement) {
      case 1:
      case 2:
      case 4:
      case 8:
        return true;
      default:
        return false;
    }
  }

  // skip waitAsync
}