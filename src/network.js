import Peer from "peerjs";
export class Network {
  constructor(events) {
    this.events = events;
    this.links = new Map();
    this.peer = null;
    this.isHost = false;
    this.closed = false;
  }
  async open(id) {
    this.peer = new Peer(id, {
      debug: 0,
      ...(import.meta.env.VITE_ICE_SERVERS
        ? {
            config: {
              iceServers: JSON.parse(import.meta.env.VITE_ICE_SERVERS),
            },
          }
        : {}),
    });
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(
        () =>
          reject(
            new Error("Signaling timed out. Check your internet connection."),
          ),
        15000,
      );
      this.peer.on("open", (id) => {
        clearTimeout(timeout);
        resolve(id);
      });
      this.peer.on("error", (e) => {
        clearTimeout(timeout);
        reject(e);
        this.events.error(e.message);
      });
      this.peer.on("disconnected", () => {
        if (!this.closed)
          this.events.error(
            "Signaling disconnected. Existing match connections may still work.",
          );
      });
    });
  }
  async host() {
    this.isHost = true;
    this.code = crypto.randomUUID().slice(0, 8).toUpperCase();
    await this.open("salvage-v1-" + this.code);
    this.peer.on("connection", (c) => {
      c.on("open", () => {
        this.links.set(c.peer, c);
        this.events.join(c.peer, c.metadata?.name);
      });
      c.on("data", (d) => this.events.data(c.peer, d));
      c.on("close", () => {
        this.links.delete(c.peer);
        this.events.leave(c.peer);
      });
      c.on("error", () => this.events.leave(c.peer));
    });
    return this.code;
  }
  async join(code, name) {
    await this.open();
    this.code = code.toUpperCase().trim();
    const c = this.peer.connect("salvage-v1-" + this.code, {
      reliable: true,
      serialization: "json",
      metadata: { name },
    });
    this.connection = c;
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(
        () =>
          reject(
            new Error(
              "Room connection timed out. Check the code; some networks require a TURN relay.",
            ),
          ),
        20000,
      );
      c.on("open", () => {
        clearTimeout(timeout);
        resolve();
      });
      c.on("data", (d) => this.events.data(c.peer, d));
      c.on("close", () => {
        clearTimeout(timeout);
        if (!this.closed)
          this.events.error("The host disconnected. This match has ended.");
        this.events.hostLost();
      });
      c.on("error", (e) => {
        clearTimeout(timeout);
        reject(e);
      });
    });
  }
  send(data, id) {
    const c = id ? this.links.get(id) : this.connection;
    if (c?.open) c.send(data);
  }
  broadcast(data) {
    for (const c of this.links.values()) if (c.open) c.send(data);
  }
  close() {
    this.closed = true;
    this.peer?.destroy();
  }
}
