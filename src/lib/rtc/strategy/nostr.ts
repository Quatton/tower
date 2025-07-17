import { signAsync } from "@noble/secp256k1";
import { Strategy } from ".";
import { SignalingClient } from "../signaling";
import { derivePublicKey, encoder, generatePrivateKey } from "../utils";
import { uuidv7 } from "uuidv7";

const now = () => Math.floor(Date.now() / 1000);

const strToNum = (str: string, limit = Number.MAX_SAFE_INTEGER) =>
  str.split("").reduce((a, c) => a + c.charCodeAt(0), 0) % limit;

const topicToKind = (() => {
  const kindCache: { [topic: string]: number } = {};
  return (topic: string) =>
    (kindCache[topic] ??= strToNum(topic, 10_000) + 20_000);
})();

const TAG = "x" as const;
const EVENT_MESSAGE_TYPE = "EVENT" as const;

export class NostrSignaling extends Strategy {
  name = "nostr";
  private subscriptions = new Map<string, string>();
  private messageHandlers = new Map<string, Function>();

  constructor(
    private readonly privateKey = generatePrivateKey(),
    private readonly publicKey = derivePublicKey(privateKey),
  ) {
    super();
  }

  init() {
    defaultRelayUrls.forEach((url) => {
      if (!this.signalingClients.has(url)) {
        const client = new SignalingClient(url);
        this.signalingClients.set(url, client);
        client.connect();
      }

      const client = this.signalingClients.get(url);

      if (!client) {
        throw new Error(`Invariant: Signaling client for ${url} not found`);
      }

      this.initPromiseRecord[url] = client.ready.then(() => client);
    });
  }

  private createSubscribeEvent(subId: string, topic: string) {
    this.subscriptions.set(subId, topic);
    return JSON.stringify([
      "REQ",
      subId,
      {
        kinds: [topicToKind(topic)],
        since: now(),
        ["#" + TAG]: [topic],
      },
    ]);
  }

  private async createEvent(topic: string, content: string) {
    const payload = {
      kind: topicToKind(topic),
      content,
      pubkey: this.publicKey,
      created_at: now(),
      tags: [[TAG, topic]],
    };

    const id = Buffer.from(
      new Uint8Array(
        await crypto.subtle.digest(
          "SHA-256",
          encoder.encode(
            JSON.stringify([
              0,
              payload.pubkey,
              payload.created_at,
              payload.kind,
              payload.tags,
              payload.content,
            ]),
          ),
        ),
      ),
    ).toString("hex");

    return JSON.stringify([
      EVENT_MESSAGE_TYPE,
      {
        ...payload,
        id,
        sig: Buffer.from(
          (await signAsync(id, this.privateKey)).toBytes(),
        ).toString("hex"),
      },
    ]);
  }

  sub(
    client: SignalingClient,
    rootTopic: string,
    selfTopic: string,
    onMessage: (
      topic: string,
      message: {
        peerId: string;
        offer?: string;
        answer?: string;
      },
      callback: (peerTopic: string, signal: any) => void,
    ) => void,
  ) {
    const rootSubId = uuidv7();
    const selfSubId = uuidv7();

    const handler = (topic: string, data: any) =>
      onMessage(topic, data, async (peerTopic: string, signal: any) =>
        client.send(await this.createEvent(peerTopic, JSON.stringify(signal))),
      );

    this.messageHandlers.set(rootSubId, handler);
    this.messageHandlers.set(selfSubId, handler);

    client.send(this.createSubscribeEvent(rootSubId, rootTopic));
    client.send(this.createSubscribeEvent(selfSubId, selfTopic));

    return () => {
      client.send(this.createUnsubscribeEvent(rootSubId));
      client.send(this.createUnsubscribeEvent(selfSubId));
      this.messageHandlers.delete(rootSubId);
      this.messageHandlers.delete(selfSubId);
    };
  }

  private createUnsubscribeEvent(subId: string) {
    this.subscriptions.delete(subId);
    return JSON.stringify(["CLOSE", subId]);
  }

  async pub(client: SignalingClient, root: string) {
    return client.send(
      await this.createEvent(
        root,
        JSON.stringify({
          peerId: this.selfId,
        }),
      ),
    );
  }
}

export const defaultRelayUrls = [
  // "black.nostrcity.club",
  // "eu.purplerelay.com",
  // "ftp.halifax.rwth-aachen.de/nostr",
  "nostr.cool110.xyz",
  // "nostr.data.haus",
  "nostr.mom",
  // "nostr.oxtr.dev",
  // "nostr.sathoarder.com",
  // "nostr.vulpem.com",
  // "nostrelay.memory-art.xyz",
  // "playground.nostrcheck.me/relay",
  "relay.agorist.space",
  // "relay.binaryrobot.com",
  // "relay.fountain.fm",
  // "relay.mostro.network",
  // "relay.nostraddress.com",
  // "relay.nostrdice.com",
  // "relay.nostromo.social",
  // "relay.oldenburg.cool",
  "relay.snort.social",
  "relay.verified-nostr.com",
  // "sendit.nosflare.com",
  // "yabu.me/v2",
].map((url) => "wss://" + url);
