declare module lunatic {
  // put lunatic types here
  /** The channel namespace, used for creating communication channels between threads. */
  export namespace Channel {
    /** A method for creating a brand new message channel with a message count limit. */
    export function create(bound: usize): MessageChannel;

    /** A method for creating a reference to an already existing MessageChannel, given it's id. */
    export function from(id: u32): MessageChannel;

    /** The MessageChannel class, used for communicating with a single channel between multiple threads. */
    export class MessageChannel {
      /** A method for sending a data payload to a given MessageChannel object. */
      public send(bytes: StaticArray<u8>): bool;

      /** A method for receiving a payload from a channel, returns null when there are no messages to recieve. */
      public receive(): StaticArray<u8> | null;
    }
  }
}
