import { iovec } from "bindings/wasi";
import { NetworkResultType } from ".";
import { IPType, MessageType, ErrCode, NetworkErrCode } from "./util";

export namespace process {
    // @ts-ignore
    @external("lunatic::process", "create_config")
    export declare function create_config(max_memory: u64, max_fuel: u64): u64;
    // @ts-ignore
    @external("lunatic::process", "drop_config")
    export declare function drop_config(config_id: u64): void;
    // @ts-ignore
    @external("lunatic::process", "allow_namespace")
    export declare function allow_namespace(config_id: u64, namespace_str_ptr: usize, namespace_str_len: u32): ErrCode;
    // @ts-ignore
    @external("lunatic::process", "preopen_dir")
    export declare function preopen_dir(config_id: u64, dir_str_ptr: usize, dir_str_len: usize, id_ptr: usize): ErrCode;
    // @ts-ignore
    @external("lunatic::process", "create_environment")
    export declare function create_environment(config_id: u64, id_ptr: usize): ErrCode;
    // @ts-ignore
    @external("lunatic::process", "create_remote_environment")
    export declare function create_remote_environment(config_id: u64, name_ptr: usize, name_len: usize, id_ptr: usize): ErrCode;
    // @ts-ignore
    @external("lunatic::process", "drop_environment")
    export declare function drop_environment(env_id: u64): void;
    // @ts-ignore
    @external("lunatic::process", "add_plugin")
    export declare function add_plugin(config_id: u64, plugin_data_ptr: usize, plugin_data_len: u32, id_ptr: usize): ErrCode;
    // @ts-ignore
    @external("lunatic::process", "add_module")
    export declare function add_module(env_id: u64, module_data_ptr: usize, module_data_len: u32, id_ptr: usize): ErrCode;
    // @ts-ignore
    @external("lunatic::process", "add_this_module")
    export declare function add_this_module(env_id: u64, id_ptr: usize): ErrCode;
    // @ts-ignore
    @external("lunatic::process", "drop_module")
    export declare function drop_module(mod_id: u64): void;
    // @ts-ignore
    @external("lunatic::process", "spawn")
    export declare function spawn(link: u64, module_id: u64, func_str_ptr: usize, func_str_len: usize, params_ptr: usize, params_len: u32, id_ptr: usize): ErrCode;
    // @ts-ignore
    @external("lunatic::process", "inherit_spawn")
    export declare function inherit_spawn(link: u64, func_str_ptr: usize, func_str_len: usize, params_ptr: usize, params_len: u32, id_ptr: usize): ErrCode;
    // @ts-ignore
    @external("lunatic::process", "drop_process")
    export declare function drop_process(process_id: u64): void;
    // @ts-ignore
    @external("lunatic::process", "clone_process")
    export declare function clone_process(process_id: u64): u64;
    // @ts-ignore
    @external("lunatic::process", "sleep_ms")
    export declare function sleep_ms(ms: u64): void;
    // @ts-ignore
    @external("lunatic::process", "die_when_link_dies")
    export declare function die_when_link_dies(trap: bool): void
    // @ts-ignore
    @external("lunatic::process", "this")
    export declare function this_handle(): u64;
    // @ts-ignore
    @external("lunatic::process", "id")
    export declare function id(pid: u64, ptr: usize): usize;
    // @ts-ignore
    @external("lunatic::process", "this_env")
    export declare function this_env(): u64;

    // @ts-ignore
    @external("lunatic::process", "link")
    export declare function link(tag: i64, process_id: u64): void;
    // @ts-ignore
    @external("lunatic::process", "unlink")
    export declare function unlink(process_id: u64): void;

    // @ts-ignore
    @external("lunatic::process", "register")
    export declare function register(name_ptr: usize, name_len: usize, version_ptr: usize, version_len: usize, env_id: u64, process_id: u64): ErrCode;
    // @ts-ignore
    @external("lunatic::process", "unregister")
    export declare function unregister(name_ptr: usize, name_len: usize, version_ptr: usize, version_len: usize, env_id: u64): ErrCode;

    // @ts-ignore
    @external("lunatic::process", "lookup")
    export declare function lookup(name_ptr: usize, name_len: u32, query_ptr: usize, query_len: u32, id_u64_ptr: usize): usize
}

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
    export declare function send_receive_skip_search(process_id: u64, timeout: u32): u32;
    // @ts-ignore: decorator
    @external("lunatic::message", "receive")
    export declare function receive(tag: usize /* *const i64 */, tag_len: usize, timeout: u32): MessageType;
}

export namespace error {

    /**
     * Obtain the length of an error string.
     *
     * @param {u64} id - The id of the error.
     * @returns {usize} The length of the string.
     */
    // @ts-ignore: external is valid here
    @external("lunatic::error", "string_size")
    export declare function string_size(id: u64): usize;


    /**
     * Write the utf8 string into memory.
     *
     * @param {u64} id - The error id.
     * @param {usize} ptr [*mut u8] The pointer to memory where it will be written.
     */
    // @ts-ignore
    @external("lunatic::error", "to_string")
    export declare function to_string(id: u64, ptr: usize): void;

    /**
     * Drop the error
     *
     * @param {u64} id - The error id.
     */
    // @ts-ignore
    @external("lunatic::error", "drop")
    export declare function drop_error(id: u64): void;
}

export namespace net {

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
    export declare function resolve(name_str_ptr: usize, name_str_len: usize, timeout: u32, id_ptr: usize): ErrCode;

    /**
     * Drop a dns iterator.
     *
     * @param {u64} id - The ID of the iterator.
     */
    // @ts-ignore: external is valid here
    @external("lunatic::networking", "drop_dns_iterator")
    export declare function drop_dns_iterator(id: u64): void;

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
     * Read from a tcp stream. This function does the following things.
     *
     * @param stream_id - The TCP Stream to be read from.
     * @param buffer_ptr - The pointer to the buffer.
     * @param buffer_len - The length of the buffer.
     * @param timeout - A timeout.
     * @param opaque_ptr - A pointer to the error id.
     */
    // @ts-ignore: external is valid here
    @external("lunatic::networking", "tcp_read")
    export declare function tcp_read(stream_id: u64, buffer_ptr: usize, buffer_len: usize, timeout: u32, opaque_ptr: usize): NetworkErrCode;

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
    export declare function tcp_write_vectored(stream_id: u64, ciovec_array_ptr: iovec, ciovec_array_len: u32, timeout: u32, opaque_ptr: usize): NetworkErrCode;

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
        addr_u8_ptr: u32,
        port: u32,
        flow_info: u32,
        scope_id: u32,
        timeout: u32,
        id_u64_ptr: usize,
    ): ErrCode;

    /**
     * Get the IP address associated with this listener.
     *
     * @param {u64} tcp_listener_id - The tcp_listener id.
     * @param {usize} id_u64_ptr - The u64 pointer to write the dns iterator to.
     */
    // @ts-ignore: external is valid here
    @external("lunatic:net", "local_addr")
    export declare function local_addr(
        tcp_listener_id: u64,
        id_u64_ptr: usize,
    ): ErrCode;

  /**
   * Bind to a udp socket to the given address
   *
   * @param {IPType} addr_type - The address type of the address being bound to.
   * @param {usize} addr_u8_ptr - A pointer to the address octets being bound to.
   * @param {u16} port - The port of the address being boudn to.
   * @param {u32} flow_info 
   * @param {u32} scope_id 
   * @param {usize} id_u64_ptr 
   */
  // @ts-ignore: External is valid here
  @external ("lunatic::networking", "udp_bind")
  export declare function udp_bind(
    addr_type: IPType,
    addr_u8_ptr: usize,
    port: u16,
    flow_info: u32,
    scope_id: u32,
    id_u64_ptr: usize,
  ): ErrCode;

  /**
   * Read data from a socket.
   *
   * @param {u64} socket_id - The socket id of the socket being read from.
   * @param {usize} buffer_ptr - A pointer to a buffer to read the bytes.
   * @param {usize} buffer_len - The length of that buffer.
   * @param {u32} timeout - How long to wait before a read times out.
   * @param {usize} opaque_ptr - A pointer to write the number of bytes written.
   * @param {usize} dns_iter_ptr - A pointer to the generated dns_iterator to obtain the ip address.
   */
  // @ts-ignore: External is valid here
  @external ("lunatic::networking", "udp_read")
  export declare function udp_read(
    socket_id: u64,
    buffer_ptr: usize,
    buffer_len: u32,
    timeout: u32,
    opaque_ptr: usize,
    dns_iter_ptr: usize,
  ): NetworkErrCode;

  /**
   * Send data from a socket to an Address.
   *
   * @param {u64} socket_id -The socket id.
   * @param {usize} buffer_ptr - A pointer to an array of bytes.
   * @param {usize} buffer_len - The length of that byte array.
   * @param {IPAddress} addr_type - The IP Address type being sent to.
   * @param {usize} addr_u8_ptr - The IP Address being sent to.
   * @param {u16} port - The port of the IP Address being sent to.
   * @param {u32} flow_info - The flow info of the IP Address being sent to.
   * @param {u32} scope_id - The scope id of the IP Address being sent to.
   * @param {u32} timeout - The ammount of time before a socket write timeout occurs.
   * @param {usize} opaque_ptr - A pointer to the number of bytes written, or the error id.
   */
  // @ts-ignore: external valid here
  @external("lunatic::networking", "udp_send_to")
  export declare function udp_send_to(
    socket_id: u64,
    buffer_ptr: usize,
    buffer_len: usize,
    addr_type: u32,
    addr_u8_ptr: usize,
    port: u32,
    flow_info: u32,
    scope_id: u32,
    timeout: u32,
    opaque_ptr: usize,
  ): NetworkErrCode;

  /**
   * Drop a udp socket.
   *
   * @param {u64} socket_id - The socket to be dropped.
   */
  // @ts-ignore: external valid here
  @external("lunatic::networking", "drop_udp_socket")
  export declare function drop_udp_socket(socket_id: u64): void;

  /**
   * Get the broadcast value for this socket.
   *
   * @param socket_id - The socket id of the socket.
   */
  // @ts-ignore: external valid here
  @external("lunatic::networking", "get_udp_socket_broadcast")
  export declare function get_udp_socket_broadcast(socket_id: u64): bool;

  /**
   * Set the broadcast value for this socket.
   *
   * @param socket_id 
   */
  // @ts-ignore: external valid here
  @external("lunatic::networking", "set_udp_socket_broadcast")
  export declare function set_udp_socket_broadcast(socket_id: u64, broadcast: bool): void;

  /**
   * Get the ttl value for this socket.
   *
   * @param socket_id - The socket id of the socket.
   */
  // @ts-ignore: external valid here
  @external("lunatic::networking", "get_udp_socket_ttl")
  export declare function get_udp_socket_ttl(socket_id: u64): u32;

  /**
   * Set the ttl value for this socket.
   *
   * @param socket_id - The socket id of the socket.
   */
  // @ts-ignore: external valid here
  @external("lunatic::networking", "set_udp_socket_ttl")
  export declare function set_udp_socket_ttl(socket_id: u64, ttl: u32): void;

  /**
   * Clone the socket by it's id.
   *
   * @param socket_id - The socket id of the socket.
   */
  // @ts-ignore: external valid here
  @external("lunatic::networking", "clone_udp_socket")
  export declare function clone_udp_socket(socket_id: u64): u64;
}

export namespace version {
    // @ts-ignore: external is valid here
    @external("lunatic::version", "major")
    export declare function major(): i32;
    // @ts-ignore: external is valid here
    @external("lunatic::version", "minor")
    export declare function minor(): i32;
    // @ts-ignore: external is valid here
    @external("lunatic::version", "patch")
    export declare function patch(): i32;
}
