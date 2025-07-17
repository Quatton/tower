export type SignalingMessage = RTCSessionDescriptionInit | RTCIceCandidateInit;

export class SignalingClient {
  private ws: WebSocket | null = null;
  public ready: Promise<boolean> = Promise.resolve(false);

  constructor(
    public url: string,
    private signalReceivedCallback?: (data: any) => void,
  ) {}

  connect() {
    if (this.ws) {
      this.ws.close();
    }
    this.ws = new WebSocket(this.url);

    this.ready = new Promise((resolve) => {
      if (!this.ws) {
        resolve(false);
        return;
      }
      this.ws.onopen = () => {
        resolve(true);
        console.log("WebSocket connection established");
      };
    });

    this.ws.onmessage = (event) => {
      if (this.signalReceivedCallback) {
        this.signalReceivedCallback(event.data);
      }
    };

    this.ws.onclose = () => {
      console.log("WebSocket connection closed");
    };

    this.ws.onerror = (error) => {
      console.error("WebSocket error:", error);
    };
  }

  send(data: any) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    } else {
      console.error("WebSocket is not open. Cannot send data.");
    }
  }
}
