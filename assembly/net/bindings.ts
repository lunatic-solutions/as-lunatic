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
  ): void;

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

  @external("lunatic::networking", "tcp_flush")
  export declare function tcp_flush(
    tcp_listener_id: u64,
    error_id_ptr: usize,
  ): ErrCode;
}


export namespace udp {
  /**
   * Creates a new UDP socket, which will be bound to the specified address. The returned socket
   * is ready for receiving messages.
   *
   * Binding with a port number of 0 will request that the OS assigns a port to this socket. The
   * port allocated can be queried via the `udp_local_addr` method.
   *
   * Returns:
   * * 0 on success - The ID of the newly created UDP socket is written to **id_u64_ptr**
   * * 1 on error   - The error ID is written to **id_u64_ptr**
   *
   * Traps:
   * * If **addr_type** is neither 4 or 6.
   * * If any memory outside the guest heap space is referenced.
   */
  // @ts-ignore: external
  @external("lunatic::networking", "udp_bind")
  export declare function udp_bind(addr_type: IPType, addr_u8_ptr: usize, port: u32, flow_info: u32, scope_id: u32, id_u64_ptr: usize): ErrCode;

  // @ts-ignore: external
  @external("lunatic::networking", "drop_udp_socket")
  export declare function drop_udp_socket(udp_socket_id: u64): void;

  /**
   * Reads data from the connected udp socket and writes it to the given buffer. This method will
   * fail if the socket is not connected.
   *
   * Returns:
   * * 0 on success    - The number of bytes read is written to **opaque_ptr**
   * * 1 on error      - The error ID is written to **opaque_ptr**
   *
   * Traps:
   * * If the socket ID doesn't exist.
   * * If any memory outside the guest heap space is referenced.
   */
  // @ts-ignore: external
  @external("lunatic::networking", "udp_receive")
  export declare function udp_receive(socket_id: u64, buffer_ptr: usize, buffer_len: usize, opaque_ptr: usize): ErrCode;
  /**
   * Receives data from the socket.
   *
   * Returns:
   * * 0 on success    - The number of bytes read is written to **opaque_ptr** and the sender's
   *                     address is returned as a DNS iterator through i64_dns_iter_ptr.
   * * 1 on error      - The error ID is written to **opaque_ptr**
   *
   * Traps:
   * * If the stream ID doesn't exist.
   * * If any memory outside the guest heap space is referenced.
   */
  // @ts-ignore: external
  @external("lunatic::networking", "udp_receive_from")
  export declare function udp_receive_from(socket_id: u64, buffer_ptr: usize, buffer_len: usize, opaque_ptr: usize, dns_iter_ptr: usize): ErrCode;

  /**
   * Connects the UDP socket to a remote address.
   *
   * When connected, methods `networking::send` and `networking::receive` will use the specified
   * address for sending and receiving messages. Additionally, a filter will be applied to
   * `networking::receive_from` so that it only receives messages from that same address.
   *
   * Returns:
   * * 0 on success
   * * 1 on error      - The error ID is written to **id_ptr**.
   * * 9027 on timeout - The socket connect operation timed out.
   *
   * Traps:
   * * If any memory outside the guest heap space is referenced.
   */
  // @ts-ignore: external
  @external("lunatic::networking", "udp_connect")
  export declare function udp_connect(udp_socket_id: u64, addr_type: IPType, addr_u8_ptr: usize, port: u32, flow_info: u32, scope_id: u32, timeout_duration: u64, id_u64_ptr: usize): ErrCode;

  // @ts-ignore: external
  @external("lunatic::networking", "clone_udp_socket")
  export declare function clone_udp_socket(udp_socket_id: u64): u64;

  // @ts-ignore: external
  @external("lunatic::networking", "set_udp_socket_broadcast")
  export declare function set_udp_socket_broadcast(udp_socket_id: u64, broadcast: bool): void;

  // @ts-ignore: external
  @external("lunatic::networking", "get_udp_socket_broadcast")
  export declare function get_udp_socket_broadcast(udp_socket_id: u64): bool;

  // @ts-ignore: external
  @external("lunatic::networking", "set_udp_socket_ttl")
  export declare function set_udp_socket_ttl(udp_socket_id: u64, ttl: u32): void;

  // @ts-ignore: external
  @external("lunatic::networking", "get_udp_socket_ttl")
  export declare function get_udp_socket_ttl(udp_socket_id: u64): u32;

  /**
   * Sends data on the socket to the given address.
   *
   * Returns:
   * * 0 on success    - The number of bytes written is written to **opaque_ptr**
   * * 1 on error      - The error ID is written to **opaque_ptr**
   *
   * Traps:
   * * If the stream ID doesn't exist.
   * * If any memory outside the guest heap space is referenced.
   */
  // @ts-ignore: external
  @external("lunatic::networking", "udp_send_to")
  export declare function udp_send_to(socket_id: u64, buffer_ptr: usize, buffer_len: usize, addr_type: u32, addr_u8_ptr: usize, port: u32, flow_info: u32, scope_id: u32, opaque_ptr: usize): ErrCode;

  /**
   * Sends data on the socket to the remote address to which it is connected.
   *
   * The `networking::udp_connect` method will connect this socket to a remote address. This method
   * will fail if the socket is not connected.
   *
   * Returns:
   * * 0 on success    - The number of bytes written is written to **opaque_ptr**
   * * 1 on error      - The error ID is written to **opaque_ptr**
   *
   * Traps:
   * * If the stream ID doesn't exist.
   * * If any memory outside the guest heap space is referenced.
   */
  // @ts-ignore: external
  @external("lunatic::networking", "udp_send")
  export declare function udp_send(socket_id: u64, buffer_ptr: usize, buffer_len: usize, opaque_ptr: usize): ErrCode;

  /**
   * Returns the local address of this socket, bound to a DNS iterator with just one
   * element.
   *
   * * 0 on success - The local address that this socket is bound to, returned as a DNS
   *                  iterator with just one element and written to **id_ptr**.
   * * 1 on error   - The error ID is written to **id_u64_ptr**.
   *
   * Traps:
   * * If the udp socket ID doesn't exist.
   * * If any memory outside the guest heap space is referenced.
   */
  // @ts-ignore: external
  @external("lunatic::networking", "udp_local_addr")
  export declare function udp_local_addr(udp_socket_id: u64, id_u64_ptr: u32): ErrCode;
}

export namespace tls {
    /**
     * Creates a new TLS listener, which will be bound to the specified address. The returned listener
     * is ready for accepting connections.
     *
     * Binding with a port number of 0 will request that the OS assigns a port to this listener. The
     * port allocated can be queried via the `tls_local_addr` (TODO) method.
     *
     * Returns:
     * * 0 on success - The ID of the newly created TLS listener is written to **id_u64_ptr**
     * * 1 on error   - The error ID is written to **id_u64_ptr**
     *
     * Traps:
     * * If any memory outside the guest heap space is referenced.
     */
    @external("lunatic::networking", "tls_bind")
    export declare function tls_bind(
        addr_type: IPType,
        addr_u8_ptr: usize,
        port: u16,
        flow_info: u32,
        scope_id: u32,
        id_u64_ptr: usize,
        certs_array_ptr: usize,
        certs_array_len: usize,
        keys_array_ptr: usize,
        keys_array_len: usize,
    ): ErrCode;

  /**
   * Get the IP address associated with this listener.
   *
   * @param {u64} tls_listener_id - The tcp_listener id.
   * @param {usize} id_u64_ptr - The u64 pointer to write the dns iterator to.
   */
  // @ts-ignore: external is valid here
  @external("lunatic::networking", "tls_local_addr")
  export declare function tls_local_addr(
      tls_listener_id: u64,
      id_u64_ptr: usize,
  ): ErrCode;

  /**
   * Drop a tls listener.
   *
   * @param {u64} id - The ID of the listener.
   */
  // @ts-ignore: external is valid here
  @external("lunatic::networking", "drop_tls_listener")
  export declare function drop_tls_listener(id: u64): void;

  /**
   * Accept a TLSSocket.
   *
   * @param listener_id - The TLSListener.
   * @param id_ptr - A pointer to a u64 that will contain the TCPServer id or the error.
   * @param socket_addr_id_ptr - A pointer to a u64 that will contain a dns iterator.
   * @returns {ErrCode} - `err_code.Success` If the value written to `id_ptr` is an error or a socket id.
   */
  // @ts-ignore: external is valid here
  @external("lunatic::networking", "tls_accept")
  export declare function tls_accept(listener_id: u64, id_ptr: usize, socket_addr_id_ptr: usize): ErrCode;
}