import { ASON } from "@ason/assembly";
import { Result } from "../error";

// @ts-ignore: decorator
@external("lunatic::message", "create_data")
export declare function create_data(tag: i64, capacity: u64): void;
// @ts-ignore: decorator
@external("lunatic::message", "write_data")
export declare function write_data(data: usize /* *const u8 */, data_len: usize): usize;
// @ts-ignore: decorator
@external("lunatic::message", "read_data")
export declare function read_data(data: usize /* *mut u8 */, data_len: usize): usize;
// @ts-ignore: decorator
@external("lunatic::message", "seek_data")
export declare function seek_data(position: u64): void;
// @ts-ignore: decorator
@external("lunatic::message", "get_tag")
export declare function get_tag(): i64;
// @ts-ignore: decorator
@external("lunatic::message", "data_size")
export declare function data_size(): u64;
// @ts-ignore: decorator
@external("lunatic::message", "push_process")
export declare function push_process(process_id: u64): u64;
// @ts-ignore: decorator
@external("lunatic::message", "take_process")
export declare function take_process(index: u64): u64;
// @ts-ignore: decorator
@external("lunatic::message", "push_tcp_stream")
export declare function push_tcp_stream(tcp_stream_id: u64): u64;
// @ts-ignore: decorator
@external("lunatic::message", "take_tcp_stream")
export declare function take_tcp_stream(index: u64): u64;
// @ts-ignore: decorator
@external("lunatic::message", "send")
export declare function send(process_id: u64): void;
// @ts-ignore: decorator
@external("lunatic::message", "send_receive_skip_search")
export declare function send_receive_skip_search(process_id: u64, timeout: u32): u32;

export const enum ReceiveType {
  DataMessage = 0,
  SignalMessage = 1,
  Timeout = 9027,
}

export const enum MessageType {
  None = 0,
  Signal = 1,
  Error = 2,
  Value = 3,
}

// @ts-ignore: decorator
@external("lunatic::message", "receive")
export declare function receive(tag: usize /* *const i64 */, tag_len: usize, timeout: u32): ReceiveType;

let emptyTagset = [] as StaticArray<i64>;

export class Message<TMessage> {
  constructor(public type: MessageType) {}
  
  get tag(): i64 {
    assert(this.type == MessageType.Signal);
    return get_tag();
  }

  /**
   * Obtain the message value if and only if the message type is MessageType.Value.
   */
  get value(): TMessage {
    assert(this.type == MessageType.Value);
    let size = data_size();
    let data = new StaticArray<u8>();
    let count = read_data(changetype<usize>(data), <usize>data.length);
    assert(count == size);
    return ASON.deserialize<TMessage>(data);
  }
}

@unmanaged export class Mailbox<TMessage> {
  constructor() { ERROR("Cannot construct a mailbox."); }

  receive(tags: StaticArray<i64> | null = null, timeout: u32 = 0): Message<TMessage> {
    tags = tags || emptyTagset;
    let tagsLength = tags.length;

    /**
     * Returns:
     * 0    if it's a data message.
     * 1    if it's a signal turned into a message.
     * 9027 if call timed out.
     */
    let type = receive(changetype<usize>(tags), tagsLength, timeout);
    
    switch (type) {
      case ReceiveType.DataMessage: return new Message(MessageType.Value);
      case ReceiveType.SignalMessage: return new Message(MessageType.Signal);
      case ReceiveType.Timeout: return new Message(MessageType.Error);
    }
  }
}
