import { createHash, randomUUID } from "node:crypto";
import protobuf from "protobufjs";
import WebSocket from "ws";

const DEFAULT_BASE = "https://mahjongsoul.game.yo-star.com/";
const YOSTAR_SDK_VERSION = "4.16.2";
const YOSTAR_SIGNING_SALT = "347467131a466f6865d7f2662e38841fbe2adb23";

const YOSTAR_REGIONS = {
  en: { identifier: "US", pid: "US-MAJONGSOUL", lang: "en", sdkUrl: "https://en-sdk-api.yostarplat.com" },
  kr: { identifier: "KR", pid: "KR-MAJONGSOUL", lang: "kr", sdkUrl: "https://jp-sdk-api.yostarplat.com" },
  jp: { identifier: "JP", pid: "JP-MAJONGSOUL", lang: "jp", sdkUrl: "https://jp-sdk-api.yostarplat.com" },
};

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

function signYostarPayload(head, body) {
  const headJson = JSON.stringify(head);
  const bodyJson = JSON.stringify(body);
  const sign = createHash("md5").update(headJson + bodyJson + YOSTAR_SIGNING_SALT).digest("hex").toUpperCase();
  return { authorization: JSON.stringify({ Head: head, Sign: sign }), bodyJson };
}

async function refreshYostarSession({ uid, token, deviceId, region, sdkUrl }) {
  const cfg = YOSTAR_REGIONS[region];
  if (!cfg) throw new Error(`Unsupported Yostar region: ${region}`);
  if (!deviceId) throw new Error("MAJSOUL_DEVICE_ID is required for Yostar saved-session login");

  const head = {
    Region: cfg.identifier,
    PID: cfg.pid,
    Channel: "web",
    Platform: "pc",
    Version: YOSTAR_SDK_VERSION,
    Lang: cfg.lang,
    DeviceID: deviceId,
    UID: uid,
    Token: token,
    Time: Math.floor(Date.now() / 1000),
  };
  const body = {};
  const signed = signYostarPayload(head, body);
  const response = await fetch(`${sdkUrl || cfg.sdkUrl}/user/quick-login`, {
    method: "POST",
    headers: {
      Authorization: signed.authorization,
      Accept: "application/json, text/plain, */*",
      "Content-Type": "application/json",
      "User-Agent": "Mozilla/5.0 ppong-nya-collector",
    },
    body: signed.bodyJson,
  });
  const text = await response.text();
  let payload;
  try { payload = JSON.parse(text); } catch { payload = { raw: text }; }
  if (!response.ok || payload?.Code !== 200) {
    throw new Error(`Yostar quick-login failed: HTTP ${response.status} ${JSON.stringify(payload)}`);
  }
  const refreshedToken = payload?.Data?.UserInfo?.Token;
  if (!refreshedToken) throw new Error(`Yostar quick-login did not return a session token: ${JSON.stringify(payload)}`);
  return refreshedToken;
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
    return { id, payload: responseType.toObject(responseType.decode(wrapper.data), { longs: String }) };
  }
}

function splitOAuthCredential(value) {
  const separator = value.lastIndexOf("-");
  if (separator <= 0 || separator === value.length - 1) return null;
  return { code: value.slice(0, separator), uid: value.slice(separator + 1) };
}

export class MajsoulClient {
  constructor({
    baseUrl = process.env.MAJSOUL_URL_BASE || DEFAULT_BASE,
    uid,
    token,
    deviceId = process.env.MAJSOUL_DEVICE_ID,
    accessToken,
    oauthType = uid && token ? 22 : 7,
    loginRegion = "en",
    yostarRegion = process.env.MAJSOUL_YOSTAR_REGION || loginRegion,
    yostarSdkUrl = process.env.MAJSOUL_YOSTAR_SDK_URL,
    routeId = process.env.MAJSOUL_ROUTE_ID,
    resourceVersion = process.env.MAJSOUL_RESOURCE_VERSION,
    productVersion = process.env.MAJSOUL_PRODUCT_VERSION,
  }) {
    this.baseUrl = baseUrl;
    this.uid = uid;
    this.token = token;
    this.deviceId = deviceId;
    this.accessToken = accessToken;
    this.oauthType = Number(oauthType);
    this.loginRegion = loginRegion;
    this.yostarRegion = yostarRegion;
    this.yostarSdkUrl = yostarSdkUrl;
    this.routeId = routeId || `${loginRegion}-2`;
    this.resourceVersion = resourceVersion;
    this.productVersion = productVersion;
    this.pending = new Map();
  }

  async resolveLoginAccessToken() {
    if (this.oauthType === 22) {
      if (!this.uid || !this.token) {
        throw new Error("MAJSOUL_UID and MAJSOUL_TOKEN are required for Yostar OAuth type 22");
      }
      const transientToken = await refreshYostarSession({
        uid: this.uid,
        token: this.token,
        deviceId: this.deviceId,
        region: this.yostarRegion,
        sdkUrl: this.yostarSdkUrl,
      });
      const auth = await this.rpc(".lq.Lobby.oauth2Auth", {
        type: 22,
        code: transientToken,
        uid: this.uid,
        client_version_string: this.clientVersionString,
      });
      if (!auth.access_token) {
        throw new Error(`Mahjong Soul oauth2Auth(type=22) failed version=${this.clientVersionString}: ${JSON.stringify(auth)}`);
      }
      return auth.access_token;
    }

    if (!this.accessToken) throw new Error("MAJSOUL_ACCESS_TOKEN is required for legacy OAuth login");
    let accessToken = this.accessToken;
    if (this.oauthType === 7) {
      const credential = splitOAuthCredential(accessToken);
      if (credential) {
        const auth = await this.rpc(".lq.Lobby.oauth2Auth", {
          type: 7,
          code: credential.code,
          uid: credential.uid,
          client_version_string: this.clientVersionString,
        });
        if (!auth.access_token) throw new Error("Mahjong Soul oauth2Auth(type=7) did not return an access token");
        accessToken = auth.access_token;
      }
    }
    return accessToken;
  }

  async connect() {
    const runtime = await resolveRuntime(this.baseUrl);
    this.codec = new RpcCodec(runtime.protoJson);
    const legacyRuntimeVersion = runtime.version.replace(/\.[a-z]+$/i, "");
    const runtimeVersion = this.resourceVersion || legacyRuntimeVersion;
    this.clientVersionString = `WebGL_2022-${runtimeVersion}`;
    this.clientVersion = this.productVersion ? { package: this.productVersion, resource: runtimeVersion } : { resource: runtimeVersion };
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

    const connection = await this.rpc(".lq.Route.requestConnection", {
      type: 1,
      route_id: this.routeId,
      timestamp: Math.floor(Date.now() / 1000),
      platform: "Web",
    });
    if (connection?.error?.code) {
      throw new Error(`Mahjong Soul requestConnection failed: ${JSON.stringify(connection.error)}`);
    }

    const accessToken = await this.resolveLoginAccessToken();
    let check = await this.rpc(".lq.Lobby.oauth2Check", { type: this.oauthType, access_token: accessToken });
    if (!check.has_account) {
      await new Promise((resolve) => setTimeout(resolve, 1500));
      check = await this.rpc(".lq.Lobby.oauth2Check", { type: this.oauthType, access_token: accessToken });
    }
    if (!check.has_account) throw new Error("Mahjong Soul access token has no account");

    const login = await this.rpc(".lq.Lobby.oauth2Login", {
      type: this.oauthType,
      access_token: accessToken,
      reconnect: false,
      device: {
        platform: "pc",
        hardware: "pc",
        os: "windows",
        os_version: "win11",
        is_browser: true,
        software: "Chrome",
        sale_platform: "web",
        screen_width: 1920,
        screen_height: 1080,
        user_agent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/150 Safari/537.36",
        screen_type: 1,
      },
      random_key: randomUUID(),
      client_version: this.clientVersion,
      client_version_string: this.clientVersionString,
      currency_platforms: [1, 4, 5, 9, 12],
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
