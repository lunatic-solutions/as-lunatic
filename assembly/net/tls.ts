import { ASManaged } from "as-disposable";
import { idPtr, Result } from "../error";
import { ErrCode, opaquePtr } from "../util";
import { tls } from "./bindings";
import { resolveDNSIterator } from "./dns";
import { IPAddress, IPType } from "./util";

export class TLSServer extends ASManaged {
  constructor(
    /** The id of this TLSServer. */
    public id: u64,
    public ip: IPAddress,
  ) {
    super(id, tls.drop_tls_listener);
  }
    
  /**
   * Bind a TLSServer to an IP address.
   *
   * @returns {Result<TLSServer | null>} The resulting TLSServer or an error.
   */
  static bind(ip: IPAddress, certs: StaticArray<u8>, keys: StaticArray<u8>): Result<TLSServer | null> {
    return TLSServer.bindUnsafe(
      changetype<usize>(ip),
      ip.type,
      ip.port,
      ip.flowInfo,
      ip.scopeId,
      changetype<usize>(certs),
      <usize>certs.length,
      changetype<usize>(keys),
      <usize>keys.length,
    );
  }

  /**
   * Bind a TCPServer unsafely to a local address.
   *
   * @returns {Result<TCPServer | null>} The resulting TCPServer or an error.
   */
  @unsafe static bindUnsafe(
    addressPtr: usize,
    addressType: IPType,
    port: u16,
    flowInfo: u32,
    scopeId: u32,
    certsPtr: usize,
    certsSize: usize,
    keysPtr: usize,
    keysSize: usize,
  ): Result<TLSServer | null> {
    let result = tls.tls_bind(
      addressType,
      addressPtr,
      port,
      flowInfo,
      scopeId,
      opaquePtr,
      certsPtr,
      certsSize,
      keysPtr,
      keysSize,
    );
    let id = load<u64>(opaquePtr);
    if (result == ErrCode.Success) {
      let ipResult = tls.tls_local_addr(id, opaquePtr);
      let iteratorId = load<u64>(opaquePtr);
      if (ipResult == ErrCode.Success) {
        let ipAddress = resolveDNSIterator(iteratorId);
        assert(ipAddress.length == 1);
        let server = new TLSServer(id, ipAddress[0]);
        return new Result<TLSServer | null>(server);
      }
      tls.drop_tls_listener(id);
      return new Result<TLSServer | null>(null, iteratorId);
    }
    return new Result<TLSServer | null>(null, id);
  }

  /** Utilized by ason to serialize a process. */
  __asonSerialize(): StaticArray<u8> {
    ERROR("TLSServer cannot be serialized.");
  }

  /** Utilized by ason to deserialize a process. */
  __asonDeserialize(_buffer: StaticArray<u8>): void {
    ERROR("TLSServer cannot be deserialized.");
  }

  
  /**
   * Accept a TCP connection. This method blocks the current thread indefinitely, waiting for an
   * incoming TCP connection.
   */
   accept(): Result<TLSSocket | null> {
    let result = tls.tls_accept(this.id, idPtr, opaquePtr);
    let id = load<u64>(idPtr);
    if (result == ErrCode.Success) {
      let dnsIterator = load<u64>(opaquePtr);
      let ipResolutions = resolveDNSIterator(dnsIterator);
      assert(ipResolutions.length == 1);
      return new Result<TLSSocket | null>(new TLSSocket(id, unchecked(ipResolutions[0])))
    }
    return new Result<TLSSocket | null>(null, id);
  }

  /** Drop the tcp listener resource. */
  drop(): void {
    tls.drop_tls_listener(this.id);
    this.preventFinalize();
  }
}
