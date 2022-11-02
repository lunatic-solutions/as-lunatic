import { Process } from ".";
import { Mailbox } from "../message";
import { MessageType } from "../message/util";


export abstract class SupervisorMessage {}

export class SupervisorSpawnMessage<TStart> extends SupervisorMessage {
  constructor(
    public start: TStart,
  ) {
    super();
  }
}

export class SupervisorContext<TStart, TMessage> {
  constructor(
    public on_delegate: (process: Process<TMessage>) => void,
    public spawn_process: (start: TStart, mb: Mailbox<TMessage>) => void,
  ) {}
}

export class Supervisor<TStart, TMessage> {
  self: Process<SupervisorMessage>;

  constructor(
    spawnProcess: (start: TStart, mb: Mailbox<TMessage>) => void,
    onDelegate: (process: Process<TMessage>,
  ) => void) {
    let context = new SupervisorContext<TStart, TMessage>(onDelegate, spawnProcess);
    this.self = Process.inheritSpawnWith<SupervisorContext<TStart, TMessage>, SupervisorMessage>(context, handle_supervisor)
      .expect("Could not spawn supervisor.");
  }

  spawn(startValue: TStart): Process<TMessage> {
    let message = this.self.request<SupervisorMessage, Process<TMessage>>(new SupervisorSpawnMessage<TStart>(startValue));
    assert(message.type == MessageType.Data);
    return message.unbox();
  }
}

export class ProcessState<TStart, TMessage> {
  constructor(
    public start_value: TStart,
    public process: Process<TMessage>,
  ) {}
}

export function handle_supervisor<TStart, TMessage>(context: SupervisorContext<TStart, TMessage>, mb: Mailbox<SupervisorMessage>): void {
  let processes = new Map<u64, ProcessState<TStart, TMessage>>();
  let delegate: Process<TMessage> | null = null;

  while (true) {
    let message = mb.receive();

    if (message.type == MessageType.Data) {
      // handle supervisor requests here
      let event = message.unbox();
      if (event instanceof SupervisorSpawnMessage) {
        let spawn_event = <SupervisorSpawnMessage<TStart>>event;
        let process = Process.inheritSpawnWith(spawn_event.start, context.spawn_process)
          .expect("Could not spawn process");
        message.reply<Process<TMessage>>(process);
        let tag = Process.link(process);
        processes.set(tag, new ProcessState<TStart, TMessage>(spawn_event.start, process));

        if (delegate == null) {
          context.on_delegate(process);
          delegate = process;
        }
        continue;
      }
    } else if (message.type == MessageType.Signal) {
      // a process died, 
      let tag = message.tag;

      // get the old process by it's tag
      let processContext = processes.get(tag);
      let proc = Process.inheritSpawnWith<TStart, TMessage>(processContext.start_value, context.spawn_process)
        .expect();

      // delete the old process
      processes.delete(tag);

      // create a new process and set it to the old process context
      tag = Process.link(proc);
      processContext.process = proc;
      processes.set(tag, processContext);

      continue;
    }

  }
}