import { uuidv7 } from "uuidv7";
import { Peer } from "../peer";
import { sha1, generateAESKey, decrypt, encrypt } from "../utils";
import { getOrCreateLocalStorageItem } from "@/lib/utils";
import { SignalingClient } from "../signaling";
import { Room } from "../room";

export const APP_NAME = "tower.qttn.dev";
export const PASSWORD_THAT_ACTUALLY_SHOULD_NOT_BE_INCLUDED_AS_PLAINTEXT_HERE =
  "password";
const POOL_SIZE = 10;

export abstract class Strategy {
  // const
  public readonly selfId = getOrCreateLocalStorageItem("selfId", uuidv7);

  // state
  public isInitialized = false;
  protected roomConnections: { [roomId: string]: RoomConnection } = {};
  public initPromiseRecord: Record<string, Promise<SignalingClient>> = {};

  // clients
  public signalingClients: Map<string, SignalingClient> = new Map();
  // will be impl by each strategy
  abstract readonly name: string;
  abstract init(): void;
  abstract pub(client: SignalingClient, root: string): Promise<void>;
  abstract sub(
    client: SignalingClient,
    root: string,
    self: string,
    onMessage: (
      topic: string,
      message: {
        peerId: string;
        offer?: string;
        answer?: string;
      },
      callback: (peerTopic: string, signal: any) => void,
    ) => void,
  ): () => void;

  joinRoom(roomId: string): Room {
    if (this.roomConnections[roomId]) {
      return this.roomConnections[roomId].room;
    }

    this.roomConnections[roomId] = new RoomConnection(roomId, this);
    return this.roomConnections[roomId].room;
  }
}

export class RoomConnection {
  private pendingOffers = new Map<string, Map<string, Peer>>();
  private connectedPeers = new Map<string, Peer>();
  private onPeerConnect: (peer: Peer) => void = () => {};
  private offerPool: Peer[] = [];
  public room: Room;

  private async decryptOffer(signal: RTCSessionDescriptionInit) {
    if (!signal.sdp) {
      throw new Error("Invalid signal type");
    }
    return {
      type: signal.type,
      sdp: await decrypt(this.key, signal.sdp),
    };
  }

  private async encryptOffer(signal: RTCSessionDescriptionInit) {
    if (!signal.sdp) {
      throw new Error("Invalid signal type");
    }
    return {
      type: signal.type,
      sdp: await encrypt(this.key, signal.sdp),
    };
  }

  constructor(
    public roomId: string,
    private strategy: Strategy,

    private readonly rootTopic = `room/${this.roomId}`,
    private readonly rootTopicHash = sha1(this.rootTopic),
    private readonly selfTopicHash = sha1(
      `room/${this.roomId}/${this.strategy.selfId}`,
    ),
    private key = generateAESKey(
      PASSWORD_THAT_ACTUALLY_SHOULD_NOT_BE_INCLUDED_AS_PLAINTEXT_HERE,
      this.roomId,
    ),
  ) {
    this.room = new Room(roomId, this.onPeerConnect);
    if (!this.strategy.isInitialized) {
      this.strategy.isInitialized = true;
      this.strategy.init();
      this.offerPool = Array.from({ length: POOL_SIZE }, () => this.offer());
    }

    const unsubFns = this.strategy.signalingClients.entries().reduce(
      (acc, [url, relay]) => ({
        ...acc,
        [url]: Promise.all([rootTopicHash, selfTopicHash]).then(
          ([rootTopic, selfTopic]) =>
            this.strategy.sub(
              relay,
              rootTopic,
              selfTopic,
              this.createMessageHandler(url),
            ),
        ),
      }),
      {} as Record<string, Promise<() => void>>,
    );

    const announceTimeouts: {
      [relayUrl: string]: NodeJS.Timeout;
    } = {};

    const announceIntervals = this.strategy.signalingClients
      .keys()
      .reduce<Record<string, number>>(
        (acc, url) => ({
          ...acc,
          [url]: 5_333,
        }),
        {},
      );

    Promise.all([rootTopicHash]).then(([rootTopic]) => {
      const queueAnnounce = async (relay: SignalingClient) => {
        const ms = await this.strategy.pub(relay, rootTopic);

        if (typeof ms === "number") {
          announceIntervals[relay.url] = ms;
        }

        announceTimeouts[relay.url] = setTimeout(
          () => queueAnnounce(relay),
          announceIntervals[relay.url] || 5_333,
        );
      };

      Object.entries(unsubFns).forEach(async ([url, unsubPromise]) => {
        await unsubPromise;
        if (typeof this.strategy.initPromiseRecord[url] === "undefined") {
          throw Error(`Invariant: Signaling client for ${url} not found`);
        }
        queueAnnounce(await this.strategy.initPromiseRecord[url]);
      });
    });
  }

  public offer() {
    return new Peer(true);
  }

  public connect(peerId: string, peer: Peer, relayUrl: string) {
    if (this.connectedPeers.get(peerId) !== peer) {
      console.warn(
        `Peer with id ${peerId} already exists, reusing existing peer.`,
      );
      peer.destroy();
      return;
    }

    this.connectedPeers.set(peerId, peer);
    this.onPeerConnect(peer);

    const offer = this.pendingOffers.get(peerId);

    if (!offer) {
      return;
    }

    Object.entries(offer).forEach(([offerRelayUrl, peer]) => {
      if (offerRelayUrl !== relayUrl) {
        peer.destroy();
      }
    });

    this.pendingOffers.delete(peerId);
  }

  private createMessageHandler(url: string) {
    return async (
      topic: string,
      data: any,
      signalPeer: (topic: string, signal: string) => void,
    ) => {
      const [rootTopic, selfTopic] = await Promise.all([
        this.rootTopicHash,
        this.selfTopicHash,
      ]);

      if (rootTopic !== topic && selfTopic !== topic) {
        return;
      }

      const { peerId, offer, answer } =
        typeof data === "string" ? JSON.parse(data) : data;

      if (peerId === this.strategy.selfId || this.connectedPeers.has(peerId)) {
        return;
      }

      if (peerId && !offer && !answer) {
        // We're going to initiate an offer ourselves
        if (!this.pendingOffers.has(peerId)) {
          return;
        }

        const [peerAndOffer, topic] = await Promise.all([
          this.getOffers(1),
          sha1(`room/${this.roomId}/${peerId}`),
        ]);

        if (peerAndOffer.length === 0) {
          return;
        }

        const { peer, offer } = peerAndOffer[0]!;

        const currentPendingOffers = this.pendingOffers.get(peerId);
        if (!currentPendingOffers) {
          this.pendingOffers.set(peerId, new Map([[url, peer]]));
        } else {
          currentPendingOffers.set(url, peer);
        }

        peer.handlers.connect = () => this.connect(peerId, peer, url);
        peer.handlers.close = () => this.disconnect(peer, peerId);

        signalPeer(
          topic,
          JSON.stringify({
            peerId: this.strategy.selfId,
            offer,
          }),
        );
      } else if (offer) {
        const myOffer = this.pendingOffers.get(peerId)?.get(url);

        if (myOffer && this.strategy.selfId > peerId) {
          // strategy to reconcile a clashing offer
          return;
        }

        const peer = new Peer(false);

        peer.handlers.connect = () => this.connect(peerId, peer, url);
        peer.handlers.close = () => this.disconnect(peer, peerId);

        let plaintextOffer: RTCSessionDescriptionInit;

        try {
          plaintextOffer = await this.decryptOffer(offer);
        } catch (err) {
          console.error("Failed to decrypt offer:", err);
          return;
        }

        if (peer.isDead) {
          console.warn("Peer connection is dead, ignoring offer");
          return;
        }

        const [topic, answer] = await Promise.all([
          sha1(`room/${this.roomId}/${peerId}`),
          peer.signal(plaintextOffer),
        ]);

        if (!answer || !answer.sdp || answer.type !== "answer") {
          console.warn("Failed to create answer for offer");
          return;
        }

        signalPeer(
          topic,
          JSON.stringify({
            peerId: this.strategy.selfId,
            answer: await this.encryptOffer(
              answer as {
                type: "offer" | "answer";
                sdp: string;
              },
            ),
          }),
        );
      } else if (answer) {
        let plainAnswer;

        try {
          plainAnswer = await this.decryptOffer(answer);
        } catch (e) {
          console.error("Failed to decrypt answer:", e);
          return;
        }

        const peer = this.pendingOffers.get(peerId)?.get(url);

        if (peer && !peer.isDead) {
          peer.signal(plainAnswer);
        }
      }
    };
  }

  getOffers(n: number) {
    this.offerPool.push(
      ...Array.from(
        {
          length: n,
        },
        this.offer.bind(this),
      ),
    );

    return Promise.all(
      this.offerPool
        .splice(0, n)
        .map((peer) =>
          peer.offerPromise
            ?.then((d) => this.decryptOffer(d))
            .then((offer) => ({ peer, offer })),
        ),
    );
  }

  public disconnect(peer: Peer, peerId: string) {
    const existingPeer = this.connectedPeers.get(peerId);
    existingPeer?.destroy();
  }

  public deletePendingOffers(peerId: string, relayUrl: string) {
    if (this.connectedPeers.has(peerId)) {
      return;
    }

    const offers = this.pendingOffers.get(peerId);
    if (!offers) {
      return;
    }
    const offer = offers.get(relayUrl);
    if (offer) {
      offer.destroy();
      offers.delete(relayUrl);
    }
  }

  public destroy() {
    this.offerPool.forEach((peer) => peer.destroy());
    this.offerPool = [];
    this.connectedPeers.forEach((peer) => peer.destroy());
    this.connectedPeers.clear();
    this.pendingOffers.clear();
    this.room.destroy();
  }
}
