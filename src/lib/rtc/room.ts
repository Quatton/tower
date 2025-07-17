import { Peer } from "./peer";
import { decoder, encoder } from "./utils";

const CHUNK_SIZE = 2 ** 14;
const ACTION_TYPE_BYTE_MAX = 12 as const;
const ACTION_TYPE_INDEX = 0 as const;
const NONCE_BYTE = 1 as const;
const NONCE_INDEX = ACTION_TYPE_INDEX + ACTION_TYPE_BYTE_MAX;
const TAG_BYTE = 1 as const;
const TAG_INDEX = NONCE_INDEX + NONCE_BYTE;
const PROGRESS_BYTE = 1 as const;
const PROGRESS_INDEX = TAG_INDEX + TAG_BYTE;
const PAYLOAD_INDEX = PROGRESS_INDEX + PROGRESS_BYTE;
const PAYLOAD_SIZE = CHUNK_SIZE - PAYLOAD_INDEX;
const ONE_BYTE_MAX = 255 as const;
const BUFF_LOW_EVENT = "bufferedamountlow" as const;
const internalNs = <T extends string>(ns: T) => `@_${ns}` as const;

export class RoomAction<A, T> {
  public setOnComplete(onComplete: (data: T, peerId: string) => void) {
    this.onComplete = onComplete;
  }

  constructor(
    public action: A,
    public send: (data: T, targets?: string | string[]) => Promise<unknown>,
    public onComplete: (data: T, peerId: string) => void = () => {},
  ) {}
}

export class Room<
  TActionMap extends Record<string, any> & {
    "@_leave": string;
    "@_signal": RTCSessionDescriptionInit;
  } = {
    "@_leave": string;
    "@_signal": RTCSessionDescriptionInit;
  },
> {
  public actions: {
    [TAction in keyof TActionMap]: RoomAction<TAction, TActionMap[TAction]>;
  } = {} as any;

  public peers = new Map<string, Peer>();
  public pendingTransmissions = new Map<
    string,
    Map<
      keyof TActionMap,
      Map<
        number,
        {
          chunks: Uint8Array[];
        }
      >
    >
  >();

  private iteratePeers(
    targets: string | string[] | undefined,
    callback: (id: string, peer: Peer) => Promise<any>,
  ) {
    const peerIds = targets
      ? Array.isArray(targets)
        ? targets
        : [targets]
      : Array.from(this.peers.keys());

    return peerIds.map((peerId) => {
      const peer = this.peers.get(peerId);
      if (peer) {
        return callback(peerId, peer);
      } else {
        console.warn(`Peer with id ${peerId} not found in room`);
        return [];
      }
    });
  }

  private disconnectPeer(peerId: string) {
    const peer = this.peers.get(peerId);
    if (peer) {
      peer.destroy();
      this.peers.delete(peerId);
      this.onPeerLeave(peer, peerId);
    } else {
      console.warn(`Peer with id ${peerId} not found in room`);
    }
  }

  public withAction<TPayload = any>(action: string) {
    if (this.actions[action]) {
      console.warn(`Action ${action} already registered in room`);
      return this;
    }

    let nonce = 0;
    (this.actions as any)[action] = new RoomAction(
      action,
      async (data: TPayload, targets?: string | string[]) => {
        if (data === undefined || data === null) {
          throw new Error(
            `Data for action ${action} cannot be undefined or null`,
          );
        }
        const isJson = typeof data !== "string";

        const buffer = encoder.encode(
          isJson ? JSON.stringify(data) : String(data),
        );
        const chunkTotal = Math.ceil(buffer.byteLength / PAYLOAD_SIZE);

        const chunks = Array.from({ length: chunkTotal }, (_, i) => {
          const isLast = i === chunkTotal - 1;
          const chunk = new Uint8Array(
            PAYLOAD_INDEX +
              (i === chunkTotal - 1
                ? buffer.byteLength % PAYLOAD_SIZE || PAYLOAD_SIZE
                : PAYLOAD_SIZE),
          );

          const typeBytes = new Uint8Array(ACTION_TYPE_BYTE_MAX);
          typeBytes.set(
            encoder.encode(action.padEnd(ACTION_TYPE_BYTE_MAX, "\0")),
            ACTION_TYPE_INDEX,
          );
          chunk.set(typeBytes, ACTION_TYPE_INDEX);
          chunk.set(new Uint8Array([nonce]), NONCE_INDEX);
          chunk.set([Number(isLast) | (Number(isJson) << 3)], TAG_INDEX);
          chunk.set(
            [Math.round(((i + 1) / chunkTotal) * ONE_BYTE_MAX)],
            PROGRESS_INDEX,
          );
          chunk.set(
            buffer.subarray(i * PAYLOAD_SIZE, (i + 1) * PAYLOAD_SIZE),
            PAYLOAD_INDEX,
          );

          return chunk;
        });

        nonce = (nonce + 1) & ONE_BYTE_MAX;

        return Promise.all(
          this.iteratePeers(targets, async (id, peer) => {
            const channel = peer.channel;
            if (!channel) {
              return;
            }

            let chunkN = 0;

            while (chunkN < chunks.length) {
              const chunk = chunks[chunkN];
              if (channel.bufferedAmount > channel.bufferedAmountLowThreshold) {
                await new Promise<void>((res) => {
                  const next = () => {
                    channel.removeEventListener(BUFF_LOW_EVENT, next);
                    res();
                  };

                  channel.addEventListener(BUFF_LOW_EVENT, next);
                });
              }

              if (!this.peers.has(id)) {
                break;
              }

              peer.send(chunk);
              chunkN++;
            }
          }),
        );
      },
    );

    return this as Room<TActionMap & { [key in typeof action]: TPayload }>;
  }

  private handleData(peerId: string, data: ArrayBufferLike) {
    const buffer = new Uint8Array(data);
    const actionTypeB = buffer.slice(ACTION_TYPE_INDEX, NONCE_INDEX);
    const nullChar = String.fromCharCode(0);
    const actionType = decoder
      .decode(actionTypeB)
      .replace(new RegExp(nullChar, "g"), "");
    const nonce = buffer[NONCE_INDEX];
    const tag = buffer[TAG_INDEX];
    const progress = buffer[PROGRESS_INDEX];

    if (!actionType || !nonce || !tag || !progress) {
      console.warn(
        `Invalid data received from peer ${peerId}: ${data.byteLength} bytes`,
      );
      return;
    }

    const payload = buffer.slice(PAYLOAD_INDEX);
    const isLast = !!(tag & 1);
    const isJson = !!(tag & 8);

    if (!this.actions[actionType]) {
      console.warn(`Unknown action type: ${actionType}`);
      return;
    }

    const actionTypeAction = this.actions[actionType];

    if (!this.pendingTransmissions.has(peerId)) {
      this.pendingTransmissions.set(peerId, new Map());
    }

    const thisPending = this.pendingTransmissions.get(peerId)!;

    if (!thisPending.has(actionType)) {
      thisPending.set(actionType, new Map());
    }

    const thisPendingAction = thisPending.get(actionType)!;

    if (!thisPendingAction.has(nonce)) {
      thisPendingAction.set(nonce, { chunks: [] });
    }

    const target = thisPendingAction.get(nonce)!;

    target.chunks.push(payload);

    // this.actions[actionType].onProgress ?

    if (!isLast) {
      return;
    }

    const full = new Uint8Array(
      target.chunks.reduce((acc, chunk) => acc + chunk.byteLength, 0),
    );

    target.chunks.reduce((acc, chunk) => {
      full.set(chunk, acc);
      return acc + chunk.byteLength;
    }, 0);

    // above code is basically a concat operation

    thisPendingAction.delete(nonce);

    const text = decoder.decode(full);
    actionTypeAction.onComplete(isJson ? JSON.parse(text) : text, peerId);
  }

  constructor(
    public id: string,
    public onPeerJoin: (peer: Peer, id: string) => void = () => {},
    public onPeerLeave: (peer: Peer, id: string) => void = () => {},
  ) {
    this.actions = this.withAction<string>(
      internalNs("leave"),
    ).withAction<RTCSessionDescriptionInit>(internalNs("signal")).actions;

    this.actions[internalNs("leave")].setOnComplete(() => {
      this.peers.forEach((peer, id) => {
        this.disconnectPeer(id);
      });
    });
    this.actions[internalNs("signal")].setOnComplete((signal, id) => {
      const peer = this.peers.get(id);
      if (peer) {
        peer.handlers.signal(signal);
      }
    });
  }

  public onPeerConnect(peer: Peer, id: string) {
    if (this.peers.has(id)) {
      console.warn(`Peer with id ${id} already exists in room`);
      return;
    }

    this.peers.set(id, peer);

    peer.handlers.data = this.handleData.bind(this, id);
    peer.handlers.signal = (signal: RTCSessionDescriptionInit) => {
      this.actions[internalNs("signal")].send(signal, id);
    };
    peer.handlers.close = () => {
      this.disconnectPeer(id);
    };
    peer.handlers.error = (error: any) => {
      console.error(`Error in peer ${id}:`, error);
      this.disconnectPeer(id);
    };

    this.onPeerJoin(peer, id);
  }

  public async leave() {
    await this.actions[internalNs("leave")].send(this.id);
    await new Promise<void>((resolve) => setTimeout(resolve, 99)); // 99 for some reason i copied the code
    this.peers.forEach((peer, id) => {
      this.disconnectPeer(id);
    });
  }

  public setOnPeerJoin(callback: (peer: Peer, id: string) => void) {
    this.onPeerJoin = callback;
  }

  public setOnPeerLeave(callback: (peer: Peer, id: string) => void) {
    this.onPeerLeave = callback;
  }

  public destroy() {
    this.peers.forEach((peer, id) => {
      peer.destroy();
      this.onPeerLeave(peer, id);
    });
    this.peers.clear();
    this.pendingTransmissions.clear();
  }
}
