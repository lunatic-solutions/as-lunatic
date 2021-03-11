/// <reference path="../node_modules/assemblyscript/std/assembly/index.d.ts" />

declare module "channel" {
  /** The channel namespace and Class, used for creating communication channels between threads. */
  export class Channel {
    /**
     * A method for creating a brand new message channel with a message
     * count limit equal to the bound.
     *
     * @param {usize} bound - Default is [0], which provides an unbounded Message channel.
     */
    public static create(bound?: usize): Channel;

    /** Deserialize a channel by it's serialized value, and obtain a reference to message and receive data through it. */
    public static deserialize(value: u64): Channel;

    /** The channel id for the sender portion of this MessageChannel. */
    public sender: u32;
    /** The channel id for the receiver portion of this MessageChannel. */
    public receiver: u32;

    /** Return a serialized value of this message channel. */
    public serialize(): u64;

    /** A method for sending a data payload to a given MessageChannel object. */
    public send(bytes: StaticArray<u8>): bool;

    /** A method for sending data by simply referencing a pointer to memory and the bytelength, considdered unsafe. */
    public sendUnsafe(ptr: usize, length: usize): bool;

    /** A method for receiving a payload from a channel, returns null when there are no messages to recieve. */
    public receive(): StaticArray<u8> | null;
  }
}

declare module "thread" {
  /** A reference that reperesents a handle to a process. */
  export class Process {
    private _pid: u32;
    /** The process id. */
    public readonly pid: u32;

    /**
     * Start a process with a given value that calls the provided callback.
     *
     * @param {T} value - A given workload value for this Process.
     * @param {(value: T) => void} callback - A callback to be called on the Process thread.
     */
    public static spawn<T>(value: T, callback: (val: T) => void): Process;

    /** Cause the current process to sleep. */
    public static sleep(ms: u64): void;

    /** Wait for the process to finish executing. */
    public join(): bool;

    /** Detatch the process from the current thread. */
    public detach(): void;

    /** Cancel the process, terminating it. */
    public drop(): void;
  }
}

declare module "net" {
  /** A handle for a tcp socket connection. */
  export class TCPSocket {
    /** A method for connecting to a TCP server by it's IP address bytes. */
    public static connect(ip: StaticArray<u8>, port: u16): TCPSocket | null;

    /** A method for deserializing a TCPSocket across channels.  */
    public static deserialize(value: u32): TCPSocket;

    /** A method for serializing a tcp socket to be sent across channels. */
    public serialize(): u32;

    /** A method for reading a memory segment from the socket. Returns null */
    public read(): StaticArray<u8> | null;

    /** A method for reading socket data into an array of static arrays. Returns 0 if no bytes were read. */
    public readVectored(buffers: Array<StaticArray<u8>>): usize;

    /** Write a buffer of data to the tcp socket. */
    public writeBuffer(buffer: StaticArray<u8>): usize;

    /** Write data directly to the tcp socket, given a pointer and a length. Unsafe. */
    public writeUnsafe(ptr: usize, length: usize): usize;

    /** Flush a tcp socket. */
    public flush(): bool;

    /** Close a tcp socket. */
    public close(): void;
  }

  /** Represents a TCP server that accepts tcp socket connections. */
  export class TCPServer {

    /** Deserialize a listener and return a TCPServer. */
    public static deserialize(listener: u32): TCPServer;

    /** Bind a tcp server to a port to accept tcp socket connections. */
    public static bind(address: StaticArray<u8>, port: u16): TCPServer | null;

    /** Accept a new socket when a new connection comes in. */
    public accept(): TCPSocket | null;

    /** Close the port, no longer accept connections. */
    public close(): void;

    /** Serialize this listener for sending across Channels. */
    public serialize(): u32;
  }
}