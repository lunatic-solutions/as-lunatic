import { ASManaged } from "as-disposable/assembly/index";
import { OBJECT, TOTAL_OVERHEAD } from "assemblyscript/std/assembly/rt/common";
import { getError, idPtr, Result } from "../error";
import { error } from "../error/bindings";
import { message } from "../message/bindings";
import { ErrCode, opaquePtr } from "../util";
import { udp } from "./bindings";
import { resolveDNSIterator } from "./dns";
import { IPAddress, IPType, NetworkResultType, UDPResult } from "./util";

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

  @unsafe private unsafeReceiveFromImpl(udpBuffer: usize, length: usize): UDPResult {
    let result = udp.udp_receive_from(
      this.id,
      udpBuffer,
      length,
      opaquePtr,
      idPtr,
    );
    let opaqueValue = load<u64>(opaquePtr);
    if (result == ErrCode.Success) {
      // get the ip address
      let dnsId = load<u64>(idPtr);
      let ips = resolveDNSIterator(dnsId);
      assert(ips.length == 1);
      return new UDPResult(NetworkResultType.Success, null, 0, unchecked(ips[0]));
    } else {
      let errorDesc = getError(opaqueValue);
      error.drop_error(opaqueValue);
      return new UDPResult(NetworkResultType.Error, errorDesc, opaqueValue);
    }
  }

  @unsafe private unsafeReceiveImpl(udpBuffer: usize, length: usize): UDPResult {
    let result = udp.udp_receive(
      this.id,
      udpBuffer,
      length,
      opaquePtr,
    );
    let opaqueValue = load<u64>(opaquePtr);
    if (result == ErrCode.Success) {
      return new UDPResult(NetworkResultType.Success, null, 0, null);
    } else {
      let errorDesc = getError(opaqueValue);
      error.drop_error(opaqueValue);
      return new UDPResult(NetworkResultType.Error, errorDesc, opaqueValue);
    }
  }

  /**
   * Receive a buffer from a given address.
   *
   * @returns {Result<NetworkResultType>} The result of attempting to receive a message.
   */
  receiveFrom<T>(buffer: T): UDPResult {
    if (buffer instanceof StaticArray) {
      let header = changetype<OBJECT>(changetype<usize>(buffer) - TOTAL_OVERHEAD);
      return this.unsafeReceiveFromImpl(
        changetype<usize>(buffer),
        <usize>header.rtSize,
      );
    } else if (buffer instanceof ArrayBuffer) {
      let header = changetype<OBJECT>(changetype<usize>(buffer) - TOTAL_OVERHEAD);
      return this.unsafeReceiveFromImpl(
        changetype<usize>(buffer),
        <usize>header.rtSize,
      );
      // @ts-ignore
    } else if (buffer instanceof ArrayBufferView) {
      // This branch doesn't account for the global ArrayBufferView class, this is safe
      return this.unsafeReceiveFromImpl(
        // @ts-ignore
        buffer.dataStart,
        // @ts-ignore
        <usize>buffer.byteLength,
      );
    } else if (buffer instanceof Array) {
      assert(buffer.length > 0);
      let item0 = unchecked(buffer[0]);
      if (isReference(item0)) ERROR("Cannot use array of references for UDPSocket#receiveFrom()");

      return this.unsafeReceiveFromImpl(
        buffer.dataStart,
        // @ts-ignore: This is safe
        <usize>buffer.length << (alignof<valueof<TData>>()),
      )
    }
    ERROR("Invalid type for UDPSocket#receiveFrom()");
  }

  /**
   * Receive a buffer from the connected address.
   *
   * @returns {UDPResult} The result of attempting to receive a message.
   */
  receive<T>(buffer: T): UDPResult {
    if (buffer instanceof StaticArray) {
      let header = changetype<OBJECT>(changetype<usize>(buffer) - TOTAL_OVERHEAD);
      return this.unsafeReceiveImpl(
        changetype<usize>(buffer),
        <usize>header.rtSize,
      );
    } else if (buffer instanceof ArrayBuffer) {
      let header = changetype<OBJECT>(changetype<usize>(buffer) - TOTAL_OVERHEAD);
      return this.unsafeReceiveImpl(
        changetype<usize>(buffer),
        <usize>header.rtSize,
      );
      // @ts-ignore
    } else if (buffer instanceof ArrayBufferView) {
      // This branch doesn't account for the global ArrayBufferView class, this is safe
      return this.unsafeReceiveImpl(
        // @ts-ignore
        buffer.dataStart,
        // @ts-ignore
        <usize>buffer.byteLength,
      );
    } else if (buffer instanceof Array) {
      assert(buffer.length > 0);
      let item0 = unchecked(buffer[0]);
      if (isReference(item0)) ERROR("Cannot use array of references for UDPSocket#receive()");

      return this.unsafeReceiveImpl(
        buffer.dataStart,
        // @ts-ignore: This is safe
        <usize>buffer.length << (alignof<valueof<TData>>()),
      )
    }
    ERROR("Invalid type for UDPSocket#receive()");
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
