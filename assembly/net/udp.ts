import { ASManaged } from "as-disposable/assembly/index";
import { idPtr, Result } from "../error";
import { message } from "../message/bindings";
import { ErrCode, opaquePtr } from "../util";
import { udp } from "./bindings";
import { resolveDNSIterator } from "./dns";
import { IPAddress, IPType, NetworkResultType } from "./util";

export class UDPSocket extends ASManaged {
  static bindIP(addr: IPAddress): Result<UDPSocket | null> {
    return UDPSocket.bindUnsafe(
      addr.type,
      changetype<usize>(addr),
      addr.port,
      addr.flowInfo,
      addr.scopeId,
    );
  }

  @unsafe static bindUnsafe(
    addressType: IPType,
    addressPtr: usize,
    port: u16,
    flowInfo: u32,
    scopeId: u32,

  ): Result<UDPSocket | null> {
    let result = udp.udp_bind(
      addressType,
      addressPtr,
      port,
      flowInfo,
      scopeId,
      idPtr,
    );
    let socketId = load<u64>(idPtr);
    if (result == ErrCode.Success) {
      return new Result<UDPSocket | null>(new UDPSocket(socketId));
    }
    return new Result<UDPSocket | null>(null, socketId);
  }

  constructor(
    public id: u64,
  ) {
    super(id, udp.drop_udp_socket);
  }

  public byteCount: usize = 0;

  public buffer: StaticArray<u8> | null = null;
  public ip: IPAddress | null = null;

  /** Utilized by ason to serialize a socket. */
  __asonSerialize(): StaticArray<u8> {
    let id = udp.clone_udp_socket(this.id);
    let messageId = message.push_udp_socket(id);
    let buff = new StaticArray<u8>(sizeof<u64>());
    let ptr = changetype<usize>(buff);
    store<u64>(ptr, messageId);
    // memory.copy(ptr + sizeof<u64>(), changetype<usize>(this.ip), offsetof<IPAddress>());
    return buff;
  }

  /** Utilized by ason to deserialize a socket. */
  __asonDeserialize(buffer: StaticArray<u8>): void {
    assert(buffer.length == sizeof<u64>());
    let id = load<u64>(changetype<usize>(buffer));
    this.id = message.take_udp_socket(id);
  }

  /**
   * Send a buffer to the given address using udp.
   *
   * @param {StaticArray<u8>} buffer - The buffer to send.
   * @param {IPAddress} addr - The IPAddress to send to.
   * @param {u32} timeout - How long to wait until the operation times out.
   * @returns {Result<NetworkResultType>} The result of sending a message to the given IPAddress using the socket.
   */
  sendTo(buffer: StaticArray<u8>, addr: IPAddress): Result<NetworkResultType> {
    let result = udp.udp_send_to(
      this.id,
      changetype<usize>(buffer),
      <usize>buffer.length,
      addr.type,
      changetype<usize>(addr),
      addr.port,
      addr.flowInfo,
      addr.scopeId,
      idPtr,
    );
    let bytesWritten = load<u64>(idPtr);
    if (result == ErrCode.Success) {
      if (bytesWritten == 0) return new Result<NetworkResultType>(NetworkResultType.Closed);
      this.byteCount = <usize>bytesWritten;
      return new Result<NetworkResultType>(NetworkResultType.Success);
    } else {
      return new Result<NetworkResultType>(NetworkResultType.Error, bytesWritten);
    }
  }

  /**
   * Send a buffer to the connected address using udp.
   *
   * @param {StaticArray<u8>} buffer - The buffer to send.
   * @param {IPAddress} addr - The IPAddress to send to.
   * @param {u32} timeout - How long to wait until the operation times out.
   * @returns {Result<NetworkResultType>} The result of sending a message to the given IPAddress using the socket.
   */
    send(buffer: StaticArray<u8>): Result<NetworkResultType> {
      let result = udp.udp_send(
        this.id,
        changetype<usize>(buffer),
        <usize>buffer.length,
        idPtr,
      );
      let bytesWritten = load<u64>(idPtr);
      if (result == ErrCode.Success) {
        if (bytesWritten == 0) return new Result<NetworkResultType>(NetworkResultType.Closed);
        this.byteCount = <usize>bytesWritten;
        return new Result<NetworkResultType>(NetworkResultType.Success);
      } else {
        return new Result<NetworkResultType>(NetworkResultType.Error, bytesWritten);
      }
    }

  /**
   * Receive a buffer from a given address.
   *
   * @param timeout - How long it should take until timeout
   * @returns {Result<NetworkResultType>} The result of attempting to receive a message.
   */
  receiveFrom(timeout: u32 = 0): Result<NetworkResultType> {
    let udpBuffer = memory.data(UDP_READ_BUFFER_SIZE);
    let result = udp.udp_receive_from(
      this.id,
      udpBuffer,
      UDP_READ_BUFFER_SIZE,
      opaquePtr,
      idPtr,
    );
    let bytesWritten = load<u64>(opaquePtr);
    if (result == ErrCode.Success) {
      // create a managed copy of the buffer
      let buffer = new StaticArray<u8>(<i32>bytesWritten);
      memory.copy(changetype<usize>(buffer), udpBuffer, <usize>bytesWritten);

      // get the ip address
      let dnsId = load<u64>(idPtr);
      let ips = resolveDNSIterator(dnsId);
      assert(ips.length == 1);

      // set the buffer, bytecount and ip
      this.buffer = buffer;
      this.byteCount = <usize>bytesWritten;
      this.ip = unchecked(ips[0]);
      return new Result<NetworkResultType>(NetworkResultType.Success);
    } else {
      return new Result<NetworkResultType>(NetworkResultType.Error, bytesWritten);
    }
  }

  /**
   * Receive a buffer from the connected address.
   *
   * @returns {Result<NetworkResultType>} The result of attempting to receive a message.
   */
  receive(): Result<NetworkResultType> {
    let udpBuffer = memory.data(UDP_READ_BUFFER_SIZE);
    let result = udp.udp_receive(
      this.id,
      udpBuffer,
      UDP_READ_BUFFER_SIZE,
      opaquePtr,
    );
    let bytesWritten = load<u64>(opaquePtr);
    if (result == ErrCode.Success) {
      // create a managed copy of the buffer
      let buffer = new StaticArray<u8>(<i32>bytesWritten);
      memory.copy(changetype<usize>(buffer), udpBuffer, <usize>bytesWritten);

      // set the buffer, bytecount and ip
      this.buffer = buffer;
      this.byteCount = <usize>bytesWritten;
      return new Result<NetworkResultType>(NetworkResultType.Success);
    } else {
      return new Result<NetworkResultType>(NetworkResultType.Error, bytesWritten);
    }
  }

  /** Set or get if this socket should broadcast. */
  get broadcast(): bool {
    return udp.get_udp_socket_broadcast(this.id);
  }

  set broadcast(value: bool) {
    udp.set_udp_socket_broadcast(this.id, value);
  }

  /** Set or get the time to live for this socket. */
  get ttl(): u32 {
    return udp.get_udp_socket_ttl(this.id);
  }

  set ttl(value: u32) {
    udp.set_udp_socket_ttl(this.id, value);
  }

  /** Clone the current socket. */
  clone(): UDPSocket {
    return new UDPSocket(udp.clone_udp_socket(this.id));
  }
}