import { TCPSocket } from "./index";
import { Process } from "../process";
import { UnmanagedResult } from "../Error";
import { Mailbox } from "../messaging";
import { NetworkResultType } from "./index";
export abstract class SocketListener {
    public timeout: u32 = 0;
    public abstract onInitialize(): void;
    public abstract onRead(data: StaticArray<u8>): bool;
    public abstract onError(desc: string): void;
    public abstract onTimeout(): bool;
    public abstract onClose(): void;
    public abstract onFinalize(): void;
}

export class SocketReaderStart<TListener extends SocketListener> {
    constructor(
        public socket: TCPSocket,
        public listener: TListener,
    ) {}
}

export class SocketReader {
    static createWith<TListener extends SocketListener>(socket: TCPSocket, listener: TListener): UnmanagedResult<SocketReader | null> {
        let start = new SocketReaderStart<TListener>(socket, listener);
        let result = Process.inheritSpawnWith<SocketReaderStart<TListener>, i32>(start,
            (start: SocketReaderStart<TListener>, mb: Mailbox<i32>) => {
                let socket = start.socket;
                let listener = start.listener;
                listener.onInitialize();
                while(true) {
                    let result = socket.read(listener.timeout);
                    if (result.isOk()) {
                        let readStatus = result.expect();
                        if (readStatus == NetworkResultType.Closed) {
                            listener.onClose();
                            break;
                        } else if (readStatus == NetworkResultType.Timeout) {
                            if (listener.onTimeout()) break;
                            continue;
                        } else if (readStatus == NetworkResultType.Success) {
                            if (listener.onRead(socket.buffer!)) break;
                            continue;
                        }
                    } else {
                        listener.onError(result.errorString);
                        break;
                    }
                }
                listener.onFinalize();
            },
        );

        if (result.isOk()) return new UnmanagedResult<SocketReader | null>(new SocketReader(result.expect()!));
        return new UnmanagedResult<SocketReader | null>(null, result.errorString);
    }

    constructor(
        public process: Process<i32>,
    ) {}
}