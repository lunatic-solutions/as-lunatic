import { ErrCode, TimeoutErrCode } from "../util";
import { MessageType } from "./util";

/** The message namespace containing all functions that reside in the "lunatic::message" namespace. */
export namespace message {
  /**
   * Create a message with a tag, and an initial capacity.
   *
   * @param {u64} tag - The tag for the data message.
   * @param {u64} capacity - The initial size of the data.
   */
  // @ts-ignore: decorator
  @external("lunatic::message", "create_data")
  export declare function create_data(tag: u64, capacity: u64): void;

  /**
   * Write data to the message.
   *
   * @param data - A pointer to the data.
   * @param data_len - The length of the data.
   */
  // @ts-ignore: decorator
  @external("lunatic::message", "write_data")
  export declare function write_data(data: usize /* *const u8 */, data_len: usize): usize;

  /**
   * Read a number of bytes from the message.
   *
   * @param {usize} data - A pointer to a buffer to write data to, read from the message.
   * @param {usize} data_len - The length of the buffer.
   */
  // @ts-ignore: decorator
  @external("lunatic::message", "read_data")
  export declare function read_data(data: usize /* *mut u8 */, data_len: usize): usize;

  /**
   * Move the data buffer index.
   *
   * @param {usize} position - The position for the buffer to read from.
   */
  // @ts-ignore: decorator
  @external("lunatic::message", "seek_data")
  export declare function seek_data(position: u64): void;
  /**
   * Get the message tag.
   */
  // @ts-ignore: decorator
  @external("lunatic::message", "get_tag")
  export declare function get_tag(): i64;
  /**
   * Get the size of the data message.
   */
  // @ts-ignore: decorator
  @external("lunatic::message", "data_size")
  export declare function data_size(): u64;

  /**
   * Push a tcp stream to the resource list.
   *
   * @param {u64} tcp_stream_id - The tcp stream id.
   * @returns The resource ID.
   */
  // @ts-ignore: decorator
  @external("lunatic::message", "push_tcp_stream")
  export declare function push_tcp_stream(tcp_stream_id: u64): u64;

  /**
   * Take a tcp stream from the resource list by it's resource id.
   *
   * @param {u64} index - The resource id.
   * @returns The tcp id.
   */
  // @ts-ignore: decorator
  @external("lunatic::message", "take_tcp_stream")
  export declare function take_tcp_stream(index: u64): u64;

  /**
   * Send the current message to a process.
   *
   * @param {u64} process_id - The process id.
   */
  // @ts-ignore: decorator
  @external("lunatic::message", "send")
  export declare function send(process_id: u64): ErrCode;

  /**
   * Push a socket to the resource list.
   * @param socket_id - The socket id.
   * @returns The resource id.
   */
  // @ts-ignore: decorator
  @external("lunatic::message", "push_udp_socket")
  export declare function push_udp_socket(socket_id: u64): u64;
  /**
   * Take a socket from the resource list by it's resource id.
   *
   * @param resource_id - The resource id of the socket.
   * @returns The socket id.
   */
  // @ts-ignore: decorator
  @external("lunatic::message", "take_udp_socket")
  export declare function take_udp_socket(resource_id: u64): u64;

  /**
   * Send a message, skipping search, with a timeout.
   *
   * @param {u64} process_id - The process id to send the message.
   * @param {u64} timeout - A timeout message.
   */
  // @ts-ignore: decorator
  @external("lunatic::message", "send_receive_skip_search")
  export declare function send_receive_skip_search(process_id: u64, timeout: u64): TimeoutErrCode;

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
  export declare function receive(tag: usize /* *const i64 */, tag_length: usize, timeout: u64): MessageType;
  
  /**
   * Push a tls stream to the resource list.
   *
   * @param {u64} tls_stream_id - The tls stream id.
   * @returns The resource ID.
   */
  // @ts-ignore: decorator
  @external("lunatic::message", "push_tls_stream")
  export declare function push_tls_stream(tcp_stream_id: u64): u64;
  
  /**
   * Take a tls stream from the resource list by it's resource id.
   *
   * @param {u64} index - The resource id.
   * @returns The tls id.
   */
  // @ts-ignore: decorator
  @external("lunatic::message", "take_tls_stream")
  export declare function take_tls_stream(index: u64): u64;
}
