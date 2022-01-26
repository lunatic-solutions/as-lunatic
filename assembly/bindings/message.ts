import { MessageType, TimeoutErrCode } from "../util";


export namespace message {
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
  @external("lunatic::message", "push_udp_socket")
  export declare function push_udp_socket(socket_id: u64): u64;
  // @ts-ignore: decorator
  @external("lunatic::message", "take_udp_socket")
  export declare function take_udp_socket(resource_id: u64): u64;
  // @ts-ignore: decorator
  @external("lunatic::message", "send_receive_skip_search")
  export declare function send_receive_skip_search(process_id: u64, timeout: u32): TimeoutErrCode;

  /**
   * Receive a message with a set of tags if given and a timeout.
   *
   * @param tag - A message tag to look for.
   * @param tag_length - A preallocated buffer capacity hint.
   * @param timeout - A timespan for how long it takes for receiving a message to timeout.
   * @returns {MessageType} The type of lunatic message being received.
   */
  // @ts-ignore: decorator
  @external("lunatic::message", "receive")
  export declare function receive(tag: usize /* *const i64 */, tag_length: usize, timeout: u32): MessageType;
}
