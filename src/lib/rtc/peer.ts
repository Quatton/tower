const iceStateEvent = "icegatheringstatechange" as const;

export class Peer {
  private pc: RTCPeerConnection;

  // state
  private isMakingOffer = false;
  private isSettingRemoteAnswerPending = false;

  // data channel
  private dataChannel: RTCDataChannel | null = null;

  get channel() {
    return this.dataChannel;
  }

  public offerPromise: Promise<RTCSessionDescriptionInit> | null;
  public createdAt = Date.now();

  get isDead() {
    return this.pc.connectionState === "closed";
  }

  public handlers: {
    data: (data: any) => void;
    connect: () => void;
    close: () => void;
    error: (error: any) => void;
    signal: (signal: RTCSessionDescriptionInit) => void;
  } = {
    data: () => {},
    connect: () => {},
    close: () => {},
    error: () => {},
    signal: () => {},
  };

  private attachHandlers() {
    if (this.dataChannel) {
      this.dataChannel.binaryType = "arraybuffer";
      this.dataChannel.bufferedAmountLowThreshold;
      this.dataChannel.onmessage = (event) => {
        this.handlers.data(event.data);
      };
      this.dataChannel.onopen = () => {
        this.handlers.connect();
      };
      this.dataChannel.onclose = () => {
        this.handlers.close();
      };
      this.dataChannel.onerror = (error) => {
        this.handlers.error(error);
      };
    }
  }

  async waitForIceGathering() {
    return await Promise.race([
      new Promise<void>((res) => {
        const checkState = () => {
          if (this.pc.iceGatheringState === "complete") {
            this.pc.removeEventListener(iceStateEvent, checkState);
            res();
          }
        };

        this.pc.addEventListener(iceStateEvent, checkState);
        checkState();
      }),
      new Promise((res) => setTimeout(res, 5000)),
    ]).then(() => {
      if (this.pc.localDescription) {
        return this.pc.localDescription;
      }
      throw new Error("No local description set after ICE gathering");
    });
  }

  constructor(public isOfferer: boolean = false) {
    this.offerPromise = isOfferer
      ? new Promise((resolve) => {
          this.handlers.signal = (signal) => {
            if (signal.type === "offer") {
              resolve({
                type: "offer",
                sdp: signal.sdp,
              });
            }
          };
        })
      : null;

    this.pc = new RTCPeerConnection({
      iceServers: [
        {
          urls: [
            "stun:stun.cloudflare.com:3478",
            "turn:turn.cloudflare.com:3478?transport=udp",
            "turn:turn.cloudflare.com:3478?transport=tcp",
            "turns:turn.cloudflare.com:5349?transport=tcp",
          ],
          username: "cd00285783a2f6cd21b032a6fed426d9",
          credential: import.meta.env.VITE_CLOUDFLARE_TURN_SECRET,
        },
      ],
    });

    if (isOfferer) {
      this.dataChannel = this.pc.createDataChannel("data");
      this.attachHandlers();
    } else {
      this.pc.ondatachannel = (event) => {
        this.dataChannel = event.channel;
        this.attachHandlers();
      };
    }

    this.pc.onnegotiationneeded = async () => {
      try {
        this.isMakingOffer = true;
        await this.pc.setLocalDescription();
        const offer = await this.waitForIceGathering();
        this.handlers.signal(offer);
      } catch (error) {
        this.handlers.error(error);
      } finally {
        this.isMakingOffer = false;
      }
    };

    this.pc.onconnectionstatechange = () => {
      if (
        ["disconnected", "failed", "closed"].includes(this.pc.connectionState)
      ) {
        this.handlers.close();
      }
    };

    if (this.isOfferer && !this.pc.canTrickleIceCandidates) {
      this.pc.onnegotiationneeded(new Event("negotiationneeded"));
    }
  }

  async signal(sdp: RTCSessionDescriptionInit) {
    if (
      this.dataChannel?.readyState === "open" &&
      !sdp.sdp?.includes("a=rtpmap")
    ) {
      return;
    }

    try {
      switch (sdp.type) {
        case "offer":
          if (
            // Already making an offer
            this.isMakingOffer ||
            // Or we are not setting remote answer
            (this.pc.signalingState !== "stable" &&
              !this.isSettingRemoteAnswerPending)
          ) {
            if (this.isOfferer) {
              return;
            }

            await Promise.all([
              () => this.pc.setLocalDescription({ type: "rollback" }),
              () => this.pc.setRemoteDescription(sdp),
            ]);
          } else {
            await this.pc.setRemoteDescription(sdp);
          }

          await this.pc.setLocalDescription();
          const answer = await this.waitForIceGathering();
          this.handlers.signal(answer);
          return answer;

        case "answer":
          this.isSettingRemoteAnswerPending = true;
          try {
            await this.pc.setRemoteDescription(sdp);
          } finally {
            this.isSettingRemoteAnswerPending = false;
          }
          break;
      }
    } catch (err) {
      this.handlers.error(err);
    }
  }

  public destroy() {
    this.dataChannel?.close();
    this.pc.close();
    this.isMakingOffer = false;
    this.isSettingRemoteAnswerPending = false;
  }

  public send(data: any) {
    if (!this.dataChannel || this.dataChannel.readyState !== "open") {
      throw new Error("Data channel is not open");
    }

    if (typeof data === "string") {
      this.dataChannel.send(data);
    } else if (data instanceof ArrayBuffer) {
      this.dataChannel.send(data);
    } else {
      throw new Error("Unsupported data type");
    }
  }
}
