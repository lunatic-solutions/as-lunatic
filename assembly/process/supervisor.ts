import { Process } from ".";
import { Mailbox, Message } from "../message";
import { MessageType } from "../message/util";

/** This class represents an abstract Supervisor Event that the supervisor must handle. */
export abstract class SupervisorEvent<TStart, TMessage> {
  abstract handle(
    ctx: HandleSupervisorContext<TStart, TMessage>,
    message: Message<SupervisorEvent<TStart, TMessage>>,
  ): void;
}

/**
 * This class represents an intention to spawn a single process. It requires a start value,
 * and has a handle method that is called by the handleSupervisor process.
 */
export class SupervisorSpawnMessage<TStart, TMessage> extends SupervisorEvent<TStart, TMessage> {
  constructor(
    public start: TStart,
  ) {
    super();
  }

  handle(ctx: HandleSupervisorContext<TStart, TMessage>, message: Message<SupervisorEvent<TStart, TMessage>>): void {
    
    // spawn the process
    let process = Process.inheritSpawnWith(this.start, ctx.supervisorContext.spawnProcess)
      .expect("Could not spawn process");

    // then reply back to the caller that the process was created
    message.reply<Process<TMessage>>(process);
    let tag = Process.link(process);
    ctx.processes.set(tag, new ProcessState<TStart, TMessage>(this.start, process));
    ctx.processList.push(process);

    // and if there's no delegate, delegate it
    if (ctx.delegate == null) {
      ctx.supervisorContext.onDelegate(process);
      ctx.delegate = process;
    }
  }
}

/**
 * This class represents an intention to send a message to one of the child processes. This
 * behavior is configured via the supervisor constructor.
 */
export class SendSupervisorMessage<TStart, TMessage> extends SupervisorEvent<TStart, TMessage> {
  constructor(
    public message: TMessage
  ) {
    super();
  }

  handle(ctx: HandleSupervisorContext<TStart, TMessage>, _message: Message<SupervisorEvent<TStart, TMessage>>): void {
    ctx.supervisorContext.onSend(ctx, this.message);
  }
}

/** This is a helper class for the supervisor process. */
export class SupervisorContext<TStart, TMessage> {

  constructor(
    public onDelegate: (process: Process<TMessage>) => void,
    public spawnProcess: (start: TStart, mb: Mailbox<TMessage>) => void,
    public onSend: (ctx: HandleSupervisorContext<TStart, TMessage>, message: TMessage) => void,
  ) {}
}

/** This is the wrapper class that represents a supervisor process. */
export class Supervisor<TStart, TMessage> {
  self: Process<SupervisorEvent<TStart, TMessage>>;

  constructor(
    onDelegate: (process: Process<TMessage>) => void,
    spawnProcess: (start: TStart, mb: Mailbox<TMessage>) => void,
    /** This callback is responsible for actually sending the messages to the processes in the process list. */
    onSend: (ctx: HandleSupervisorContext<TStart, TMessage>, message: TMessage) => void
      = (ctx: HandleSupervisorContext<TStart, TMessage>, message: TMessage) => {
          
        // round robin
        let length = ctx.processList.length;
        let index = ctx.roundRobinIndex;
        index++;
        if (index >= length) {
          index = 0;
        }
        ctx.processList[index].send(message);
        ctx.roundRobinIndex = index;
      },
  ) {
    // spawn the process
    let context = new SupervisorContext<TStart, TMessage>(onDelegate, spawnProcess, onSend);
    this.self = Process.inheritSpawnWith<
      SupervisorContext<TStart, TMessage>,
      SupervisorEvent<TStart, TMessage>
      > (
        context,
        handleSupervisor
      )
      .expect("Could not spawn supervisor.");
  }

  /**
   * Spawn a process that will be supervised and restarted with the same start value
   * each time the process fails.
   */
  spawn(startValue: TStart): Process<TMessage> {
    // request the process from the supervisor handler
    let message = this.self
      .request<SupervisorEvent<TStart, TMessage>, Process<TMessage>>(
        new SupervisorSpawnMessage<TStart, TMessage>(startValue)
      );
    assert(message.type == MessageType.Data);
    return message.unbox();
  }

  /** Send a message to the child processes. */
  send(message: TMessage): void {
    this.self.send(new SendSupervisorMessage<TStart, TMessage>(message));
  }
}
/** This is a helper class for the supervisor process. */
export class ProcessState<TStart, TMessage> {
  constructor(
    public startValue: TStart,
    public process: Process<TMessage>,
  ) {}
}

/** This is a helper class for the handle supervisor process. */
export class HandleSupervisorContext<TStart, TMessage> {
  public roundRobinIndex: i32 = 0;

  constructor(
    /** A map of processes that exist based on their tag. */
    public processes: Map<u64, ProcessState<TStart, TMessage>>,
    /** A list of all the processes. */
    public processList: Process<TMessage>[],
    /** The delegated process. */
    public delegate: Process<TMessage> | null,
    /** The supervisor context that contains all the callback events. */
    public supervisorContext: SupervisorContext<TStart, TMessage>,
  ) {}
}

/** This method is the entry point for a given supervisor. */
export function handleSupervisor<TStart, TMessage>(
  context: SupervisorContext<TStart, TMessage>,
  mb: Mailbox<SupervisorEvent<TStart, TMessage>>,
): void {
  let handleSupervisorContext = new HandleSupervisorContext<TStart, TMessage>(
    new Map<u64, ProcessState<TStart, TMessage>>(),
    [],
    null,
    context,
  );

  // process loop
  while (true) {
    let message = mb.receive();

    if (message.type == MessageType.Data) {
      // handle supervisor requests here
      let event = message.unbox();
      event.handle(handleSupervisorContext, message);
    } else if (message.type == MessageType.Signal) {
      // a process died, 
      let tag = message.tag;

      // get the old process by it's tag
      let processContext = handleSupervisorContext.processes.get(tag);
      let childProcess = Process.inheritSpawnWith<TStart, TMessage>(
          processContext.startValue, 
          context.spawnProcess,
        )
        .expect();

      // delete the old process
      handleSupervisorContext.processes.delete(tag);
      let index = handleSupervisorContext.processList.indexOf(childProcess);
      if (index != -1) {
        handleSupervisorContext.processList.splice(index, 1);
      }

      // create a new process and set it to the old process context
      tag = Process.link(childProcess);
      processContext.process = childProcess;
      handleSupervisorContext.processes.set(tag, processContext);
    }
  }
}
