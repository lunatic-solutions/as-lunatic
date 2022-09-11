import { ErrCode, TimeoutErrCode } from "../util";
import { IPType } from "./util";
import { iovec } from "@assemblyscript/wasi-shim/assembly/bindings/wasi_snapshot_preview1";

export namespace dns {
    /**
     * Performs a DNS resolution. The returned iterator may not actually yield any values
     * depending on the outcome of any resolution performed.
     *
     * @param {usize} name_str_ptr - A pointer to utf8 string that contains the host to resolve
     * @param {usize} name_str_len - The length of `name_str_ptr`
     * @param {u32} timeout - How long lunatic should wait until timing out
     * @param {usize} id_ptr - The pointer to the error or the resolution_id
     */
    // @ts-ignore: external is valid here
    @external("lunatic::networking", "resolve")
    export declare function resolve(name_str_ptr: usize, name_str_len: usize, timeout: u64, id_ptr: usize): ErrCode;

    /**
     * Drop a dns iterator.
     *
     * @param {u64} id - The ID of the iterator.
     */
    // @ts-ignore: external is valid here
    @external("lunatic::networking", "drop_dns_iterator")
    export declare function drop_dns_iterator(id: u64): void;

    /**
     * Takes the next socket address from DNS iterator and writes it to the passed pointers.
     * Address type is going to be a value of `4` or `6`, representing v4 or v6 addresses. The
     * caller needs to reserve enough space at `addr_u8_ptr` for both values to fit in (16 bytes).
     * `flow_info_u32_ptr` & `scope_id_u32_ptr` are only going to be used with version v6.
     *
     * @param {u64} dns_iter_id - The DNS Iterator.
     * @param {usize} addr_type_ptr - A pointer to the address type.
     * @param {usize} add_u8_ptr - A pointer to the address bytes
     * @param {usize} port_u16_ptr - A pointer to the port
     * @param {usize} flow_info_u32_ptr - A pointer to the IP Address's flow info
     * @param {usize} scope_id_u32_ptr - A pointer to IP Address's scope id
     */
    // @ts-ignore: external is valid here
    @external("lunatic::networking", "resolve_next")
    export declare function resolve_next(dns_iter_id: u64, addr_type_ptr: usize, add_u8_ptr: usize, port_u16_ptr: usize, flow_info_u32_ptr: usize, scope_id_u32_ptr: usize): ErrCode;
}

export namespace tcp {
  /**
   * Drop a tcp listener.
   *
   * @param {u64} id - The ID of the listener.
   */
  // @ts-ignore: external is valid here
  @external("lunatic::networking", "drop_tcp_listener")
  export declare function drop_tcp_listener(id: u64): void;

  /**
   * Drop a tcp stream.
   *
   * @param {u64} id - The ID of the stream.
   */
  // @ts-ignore: external is valid here
  @external("lunatic::networking", "drop_tcp_stream")
  export declare function drop_tcp_stream(id: u64): void;

  /**
   * Clone a TCPStream.
   *
   * @param id - The id of the socket.
   * @returns The internal id for this tcp stream in this message.
   */
  // @ts-ignore: external is valid here
  @external("lunatic::networking", "clone_tcp_stream")
  export declare function clone_tcp_stream(id: u64): u64;

  /**
   * Creates a new TCP listener, which will be bound to the specified address. The returned listener
   * is ready for accepting connections.
   *
   * Binding with a port number of 0 will request that the OS assigns a port to this listener. The
   * port allocated can be queried via the `local_addr` (TODO) method.
   *
   * @param {IPType} addr_type - The IP Address type.
   * @param {usize} addr_u8_ptr - A pointer to the address itself.
   * @param {u16} port - The port number for the IP Address
   * @param {u32} flow_info - The IPV6 Flow Info if the IP Address is v6.
   * @param {u32} scope_id - The IPV6 Scope ID if the IP Address is v6
   * @param {usize} id_u64_ptr - A pointer to the TCPListener id.
   */
  // @ts-ignore: external is valid here
  @external("lunatic::networking", "tcp_bind")
  export declare function tcp_bind(addr_type: IPType, addr_u8_ptr: usize, port: u16, flow_info: u32, scope_id: u32, id_u64_ptr: usize): ErrCode;

  /**
   * Accept a TCPListener.
   *
   * @param listener_id - The TCPListener.
   * @param id_ptr - A pointer to a u64 that will contain the TCPServer id or the error.
   * @param socket_addr_id_ptr - A pointer to a u64 that will contain a dns iterator.
   * @returns {ErrCode} - `err_code.Success` If the value written to `id_ptr` is an error or a socket id.
   */
  // @ts-ignore: external is valid here
  @external("lunatic::networking", "tcp_accept")
  export declare function tcp_accept(listener_id: u64, id_ptr: usize, socket_addr_id_ptr: usize): ErrCode;

  /**
   * Read from a tcp stream.
   *
   * @param stream_id - The TCP Stream to be read from.
   * @param buffer_ptr - The pointer to the buffer.
   * @param buffer_len - The length of the buffer.
   * @param timeout - A timeout.
   * @param opaque_ptr - A pointer to the error id.
   */
  // @ts-ignore: external is valid here
  @external("lunatic::networking", "tcp_read")
  export declare function tcp_read(stream_id: u64, buffer_ptr: usize, buffer_len: usize, opaque_ptr: usize): TimeoutErrCode;

  /**
   * Peek into a tcp stream.
   *
   * @param stream_id - The TCP Stream to be read from.
   * @param buffer_ptr - The pointer to the buffer.
   * @param buffer_len - The length of the buffer.
   * @param opaque_ptr - A pointer to the error id.
   */
  // @ts-ignore: external is valid here
  @external("lunatic::networking", "tcp_peek")
  export declare function tcp_peek(stream_id: u64, buffer_ptr: usize, buffer_len: usize, opaque_ptr: usize): TimeoutErrCode;

  /**
   * Write bytes to a stream.
   *
   * @param stream_id - The stream id.
   * @param ciovec_array_ptr - A ciovec array pointer to the data.
   * @param ciovec_array_len - The length of that vector.
   * @param timeout - A timeout in milliseconds for the write.
   * @param opaque_ptr - A pointer to write the number of bytes to, or the error.
   */
  // @ts-ignore: external is valid here
  @external("lunatic::networking", "tcp_write_vectored")
  export declare function tcp_write_vectored(stream_id: u64, ciovec_array_ptr: iovec, ciovec_array_len: u32, opaque_ptr: usize): TimeoutErrCode;

  /**
   * Create a new tcp connection to a TCP Server.
   * @param {u32} addr_type - The address type, 4 or 6
   * @param {usize} addr_u8_ptr - A pointer to a memory location containing the ip address
   * @param {u16} port - The port of the ip address.
   * @param {u32} flow_info - The flow info
   * @param {u32} scope_id - The scope id.
   * @param {u32} timeout - A timeout in ms.
   * @param {usize} id_u64_ptr - A pointer to a 64 bit number that will contain the error string id,
   *                             or the id of the tcp socket.
   */
  // @ts-ignore: external is valid here
  @external("lunatic::networking", "tcp_connect")
  export declare function tcp_connect(
      addr_type: u32,
      addr_u8_ptr: usize,
      port: u32,
      flow_info: u32,
      scope_id: u32,
      timeout: u64,
      id_u64_ptr: usize,
  ): ErrCode;

  /**
   * Get the IP address associated with this listener.
   *
   * @param {u64} tcp_listener_id - The tcp_listener id.
   * @param {usize} id_u64_ptr - The u64 pointer to write the dns iterator to.
   */
  // @ts-ignore: external is valid here
  @external("lunatic::networking", "tcp_local_addr")
  export declare function tcp_local_addr(
      tcp_listener_id: u64,
      id_u64_ptr: usize,
  ): ErrCode;

  /**
   * Set the read timeout for a given tcp stream.
   *
   * @param {u64} tcp_listener_id - The listener id.
   * @param {u64} duration - The duration in milliseconds.
   */
  // @ts-ignore: external is valid here
  @external("lunatic::networking", "set_read_timeout")
  export declare function set_read_timeout(
    tcp_listener_id: u64,
    duration: u64,
  ): ErrCode;

  /**
   * Get the current read timeout duration for a given tcp stream.
   *
   * @param {u64} tcp_listener_id - The tcp stream id.
   */
  // @ts-ignore: external is valid here
  @external("lunatic::networking", "get_read_timeout")
  export declare function get_read_timeout(
    tcp_listener_id: u64,
  ): ErrCode;

  /**
   * Set the peek timeout for a given tcp stream.
   *
   * @param {u64} tcp_listener_id - The listener id.
   * @param {u64} duration - The duration in milliseconds.
   */
  // @ts-ignore: external is valid here
  @external("lunatic::networking", "set_peek_timeout")
  export declare function set_peek_timeout(
    tcp_listener_id: u64,
    duration: u64,
  ): ErrCode;

  /**
   * Get the current peek timeout duration for a given tcp stream.
   *
   * @param {u64} tcp_listener_id - The tcp stream id.
   */
  // @ts-ignore: external is valid here
  @external("lunatic::networking", "get_peek_timeout")
  export declare function get_peek_timeout(
    tcp_listener_id: u64,
  ): ErrCode;
}