import { NetworkResultType } from "../util";
import { TCPSocket } from "../net";
import { Process } from "../process";
import { Result } from "../Error";
import { Mailbox } from "../messaging";

export abstract class SocketReader<T> {
    constructor(
        public socket: TCPSocket,
        public parentProcess: Process<T> = Process.self<T>(),
    ) {}
    public timeout: u32 = 0;
    public abstract onInitialize(): void;
    public abstract onRead(data: StaticArray<u8>): bool;
    public abstract onError(desc: string): void;
    public abstract onTimeout(): bool;
    public abstract onClose(): void;
    public abstract onFinalize(): void;

    start(): Result<Process<i32> | null> {
        let result = Process.inheritSpawnWith<SocketReader<SocketReader<T>>, i32>(this,
            (start: SocketReader<SocketReader<T>>, mb: Mailbox<i32>) => {
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
}

