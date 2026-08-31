import protobuf from "protobufjs";
import WebSocket from "ws";

const DEFAULT_BASE = "https://mahjongsoul.game.yo-star.com/";

async function fetchJson(url) {
  const response = await fetch(url, { headers: { "user-agent": "Mozilla/5.0 ppong-nya-collector" } });
  if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
  return response.json();
}

async function resolveRuntime(baseUrl) {
  const base = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  const version = await fetchJson(new URL("version.json", base));
  const resVersion = await fetchJson(new URL(`resversion${version.version}.json`, base));
  const protoPrefix = resVersion.res["res/proto/liqi.json"].prefix;
  const configPrefix = resVersion.res["config.json"].prefix;
  const [protoJson, config] = await Promise.all([
    fetchJson(new URL(`${protoPrefix}/res/proto/liqi.json`, base)),
    fetchJson(new URL(`${configPrefix}/config.json`, base)),
  ]);
  const player = config.ip.find((entry) => entry.name === "player");
  if (!player) throw new Error("Mahjong Soul player gateway configuration not found");
  let gateways = (player.gateways ?? []).map((entry) => entry.url).filter(Boolean);
  if (!gateways.length) {
    const region = Array.isArray(player.region_urls) ? player.region_urls[0] : Object.values(player.region_urls ?? {})[0];
    const regionUrl = typeof region === "string" ? region : region?.url;
    if (!regionUrl) throw new Error("Mahjong Soul gateway discovery URL not found");
    const list = await fetchJson(`${regionUrl}?service=ws-gateway&protocol=ws&ssl=true`);
    gateways = (list.servers ?? []).map((server) => `https://${server}`);
  }
  if (!gateways.length) throw new Error("No Mahjong Soul websocket gateways available");
  return { version: version.version, protoJson, gateway: gateways[Math.floor(Math.random() * gateways.length)] };
}

class RpcCodec {
  constructor(protoJson) {
    this.root = protobuf.Root.fromJSON(protoJson);
    this.wrapper = this.root.lookupType("lq.Wrapper");
    this.nextId = 1;
    this.pendingTypes = new Map();
  }
  encode(methodName, payload) {
    const servicePath = methodName.split(".").filter(Boolean);
    const method = this.root.lookupService(servicePath.slice(0, -1).join(".")).methods[servicePath.at(-1)];
    if (!method) throw new Error(`Unknown RPC method ${methodName}`);
    const requestType = method.parent.parent.lookupType(method.requestType);
    const responseType = method.parent.parent.lookupType(method.responseType);
    const id = this.nextId++ & 0xffff;
    this.pendingTypes.set(id, responseType);
    const wrapper = this.wrapper.encode({ name: methodName, data: requestType.encode(payload ?? {}).finish() }).finish();
    return { id, data: Buffer.concat([Buffer.from([2, id & 0xff, id >> 8]), wrapper]) };
  }
  decode(buffer) {
    const bytes = Buffer.from(buffer);
    if (bytes[0] !== 3) return null;
    const id = bytes[1] | (bytes[2] << 8);
    const responseType = this.pendingTypes.get(id);
    if (!responseType) return null;
    this.pendingTypes.delete(id);
    const wrapper = this.wrapper.decode(bytes.subarray(3));
    return { id, payload: responseType.toObject(responseType.decode(wrapper.data), { longs: String, bytes: Buffer }) };
  }
}

export class MajsoulClient {
  constructor({ baseUrl = process.env.MAJSOUL_URL_BASE || DEFAULT_BASE, accessToken, oauthType = 7, loginRegion = "en" }) {
    this.baseUrl = baseUrl;
    this.accessToken = accessToken;
    this.oauthType = Number(oauthType);
    this.loginRegion = loginRegion;
    this.pending = new Map();
  }
  async connect() {
    if (!this.accessToken) throw new Error("MAJSOUL_ACCESS_TOKEN is required");
    const runtime = await resolveRuntime(this.baseUrl);
    this.codec = new RpcCodec(runtime.protoJson);
    this.clientVersionString = `web-${runtime.version.replace(/\.[a-z]+$/i, "")}`;
    const gateway = runtime.gateway.replace(/^http/, "ws").replace(/\/$/, "") + "/gateway";
    this.ws = new WebSocket(gateway, { headers: { Origin: this.baseUrl.replace(/\/$/, ""), "User-Agent": "Mozilla/5.0 ppong-nya-collector" } });
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("WebSocket connect timeout")), 15000);
      this.ws.once("open", () => { clearTimeout(timer); resolve(); });
      this.ws.once("error", reject);
    });
    this.ws.on("message", (data) => {
      const decoded = this.codec.decode(data);
      if (!decoded) return;
      const waiter = this.pending.get(decoded.id);
      if (waiter) { this.pending.delete(decoded.id); waiter.resolve(decoded.payload); }
    });
    this.ws.on("close", () => {
      for (const waiter of this.pending.values()) waiter.reject(new Error("Mahjong Soul connection closed"));
      this.pending.clear();
    });
    await this.rpc(".lq.Lobby.heatbeat", { no_operation_counter: 0 });
    const check = await this.rpc(".lq.Lobby.oauth2Check", { type: this.oauthType, access_token: this.accessToken });
    if (!check.has_account) throw new Error("Mahjong Soul access token has no account");
    const login = await this.rpc(".lq.Lobby.oauth2Login", {
      type: this.oauthType,
      access_token: this.accessToken,
      reconnect: false,
      device: { platform: "pc", hardware: "pc", os: "linux", os_version: "server", is_browser: false, software: "ppong-nya", sale_platform: "web" },
      random_key: crypto.randomUUID(),
      client_version_string: this.clientVersionString,
      currency_platforms: [1, 2, 5, 6, 8, 10, 11],
      tag: this.loginRegion,
    });
    if (!login.account_id) throw new Error(`Mahjong Soul login failed: ${JSON.stringify(login.error ?? login.error_code ?? login)}`);
    return login;
  }
  rpc(methodName, payload) {
    const encoded = this.codec.encode(methodName, payload);
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { this.pending.delete(encoded.id); reject(new Error(`RPC timeout: ${methodName}`)); }, 15000);
      this.pending.set(encoded.id, { resolve: (value) => { clearTimeout(timer); resolve(value); }, reject: (error) => { clearTimeout(timer); reject(error); } });
      this.ws.send(encoded.data, (error) => { if (error) { clearTimeout(timer); this.pending.delete(encoded.id); reject(error); } });
    });
  }
  fetchLiveList(filterId) { return this.rpc(".lq.Lobby.fetchGameLiveList", { filter_id: filterId }); }
  fetchGameRecord(uuid) { return this.rpc(".lq.Lobby.fetchGameRecord", { game_uuid: uuid, client_version_string: this.clientVersionString }); }
  close() { this.ws?.close(); }
}
