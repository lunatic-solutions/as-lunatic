import { NetworkResultType } from "../util";
import { TCPSocket } from "../net";
import { Process } from "../process";
import { Result } from "../Error";
import { Mailbox } from "../messaging";

/** Represents the base class for a SocketReader, which should have a generic type the same as the mailbox type of the parent process attempting to read from it. */
export abstract class SocketReader<TParentEventBase> {
    constructor(
        /** This socket is the socket that will be read from. */
        public socket: TCPSocket,
        /** This process is normally the current process, and the generic type of the process is usually the mailbox event type. */
        public parentProcess: Process<TParentEventBase> = Process.self<TParentEventBase>(),
    ) {}
    public timeout: u32 = 0;
    /** This method is called when the child process initializes. */
    public abstract onInitialize(): void;
    /** This method is called when data is read from the socket. */
    public abstract onRead(data: StaticArray<u8>): bool;
    /** This method is called when an error occurs while reading from a socket. It should return `true` if the socket should stop reading. */
    public abstract onError(desc: string): void;
    /** This method is called when a socket read times out. It should return `true` if the socket should stop reading. */
    public abstract onTimeout(): bool;
    /** This method is called when the socket is closed. */
    public abstract onClose(): void;
    /** This method is called if the socket closed or the socket stops reading, and no errors caused a web assembly trap. */
    public abstract onFinalize(): void;

    /** Start reading from the socket on another child process. */
    start(): Result<Process<i32> | null> {
        let result = Process.inheritSpawnWith<SocketReader<TParentEventBase>, i32>(this,
            (start: SocketReader<TParentEventBase>, mb: Mailbox<i32>) => {
                let socket = start.socket;
                start.onInitialize();
                while(true) {
                    let result = socket.read(start.timeout);
                    if (result.isOk()) {
                        let readStatus = result.expect();
                        if (readStatus == NetworkResultType.Closed) {
                            start.onClose();
                            break;
                        } else if (readStatus == NetworkResultType.Timeout) {
                            if (start.onTimeout()) break;
                            continue;
                        } else if (readStatus == NetworkResultType.Success) {
                            if (start.onRead(socket.buffer!)) break;
                            continue;
                        }
                    } else {
                        start.onError(result.errorString);
                        break;
                    }
                }
                start.onFinalize();
            },
        );
        return result;
    }
    /** Send a message of type TEvent to the parent process. */
    send<TEvent extends TParentEventBase>(message: TEvent, tag: u64 = 0): void {
        this.parentProcess.send<TEvent>(message, tag);
    }
}

