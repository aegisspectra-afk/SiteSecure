import jsQR from "jsqr";
import { normalizeScanCode } from "./scanGate";

export type CameraQrStatus = "idle" | "starting" | "live" | "denied" | "unsupported" | "error";

type DetectorCtor = new (options?: { formats?: string[] }) => {
  detect: (source: CanvasImageSource) => Promise<Array<{ rawValue: string }>>;
};

function barcodeDetectorCtor(): DetectorCtor | null {
  const ctor = (globalThis as { BarcodeDetector?: DetectorCtor }).BarcodeDetector;
  return ctor ?? null;
}

export function cameraScanSupported(): boolean {
  return Boolean(navigator.mediaDevices?.getUserMedia);
}

async function decodeFrame(
  video: HTMLVideoElement,
  canvas: HTMLCanvasElement,
  detector: InstanceType<DetectorCtor> | null,
): Promise<string | null> {
  if (video.readyState < 2) return null;
  if (detector) {
    try {
      const codes = await detector.detect(video);
      const raw = codes[0]?.rawValue;
      return raw ? normalizeScanCode(raw) : null;
    } catch {
      /* fall through to jsqr */
    }
  }
  const w = video.videoWidth;
  const h = video.videoHeight;
  if (!w || !h) return null;
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(video, 0, 0, w, h);
  const image = ctx.getImageData(0, 0, w, h);
  const found = jsQR(image.data, image.width, image.height, { inversionAttempts: "attemptBoth" });
  return found?.data ? normalizeScanCode(found.data) : null;
}

export type CameraQrController = {
  start: (deviceId?: string) => Promise<void>;
  stop: () => void;
  switchCamera: () => Promise<void>;
  listDevices: () => Promise<MediaDeviceInfo[]>;
  status: () => CameraQrStatus;
};

export function createCameraQr(opts: {
  video: HTMLVideoElement;
  onCode: (code: string) => void;
  onStatus: (status: CameraQrStatus, error?: string) => void;
  isPaused: () => boolean;
}): CameraQrController {
  let stream: MediaStream | null = null;
  let timer: number | null = null;
  let status: CameraQrStatus = "idle";
  let deviceIds: string[] = [];
  let deviceIndex = 0;
  const canvas = document.createElement("canvas");
  const Detector = barcodeDetectorCtor();
  const detector = Detector ? new Detector({ formats: ["qr_code", "code_128"] }) : null;
  let lastCode = "";
  let lastAt = 0;

  const setStatus = (next: CameraQrStatus, error?: string) => {
    status = next;
    opts.onStatus(next, error);
  };

  const stopTracks = () => {
    stream?.getTracks().forEach((t) => t.stop());
    stream = null;
    opts.video.srcObject = null;
  };

  const loop = async () => {
    if (status !== "live") return;
    if (!opts.isPaused()) {
      const code = await decodeFrame(opts.video, canvas, detector);
      const now = Date.now();
      if (code && (code !== lastCode || now - lastAt > 2500)) {
        lastCode = code;
        lastAt = now;
        opts.onCode(code);
      }
    }
    timer = window.setTimeout(() => void loop(), detector ? 220 : 120);
  };

  const start = async (deviceId?: string) => {
    if (!cameraScanSupported()) {
      setStatus("unsupported");
      return;
    }
    stop();
    setStatus("starting");
    const videoConstraint: MediaTrackConstraints = deviceId
      ? { deviceId: { exact: deviceId } }
      : { facingMode: { ideal: "environment" } };
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { ...videoConstraint, width: { ideal: 1280 }, height: { ideal: 720 } },
      });
    } catch (err) {
      const name = err instanceof DOMException ? err.name : "";
      if (name === "NotAllowedError" || name === "PermissionDeniedError") {
        setStatus("denied");
        return;
      }
      if (name === "NotFoundError" || name === "OverconstrainedError") {
        setStatus("unsupported");
        return;
      }
      setStatus("error", err instanceof Error ? err.message : String(err));
      return;
    }
    opts.video.srcObject = stream;
    opts.video.setAttribute("playsinline", "true");
    opts.video.muted = true;
    await opts.video.play().catch(() => undefined);
    const devices = await navigator.mediaDevices.enumerateDevices();
    deviceIds = devices.filter((d) => d.kind === "videoinput").map((d) => d.deviceId);
    const current = stream.getVideoTracks()[0]?.getSettings().deviceId;
    if (current) {
      const idx = deviceIds.indexOf(current);
      if (idx >= 0) deviceIndex = idx;
    }
    setStatus("live");
    void loop();
  };

  const stop = () => {
    if (timer != null) {
      window.clearTimeout(timer);
      timer = null;
    }
    stopTracks();
    if (status !== "denied" && status !== "unsupported") setStatus("idle");
  };

  const listDevices = async () => {
    const devices = await navigator.mediaDevices.enumerateDevices();
    return devices.filter((d) => d.kind === "videoinput");
  };

  const switchCamera = async () => {
    if (deviceIds.length < 2) {
      const listed = await listDevices();
      deviceIds = listed.map((d) => d.deviceId);
    }
    if (deviceIds.length < 2) return;
    deviceIndex = (deviceIndex + 1) % deviceIds.length;
    await start(deviceIds[deviceIndex]);
  };

  return {
    start,
    stop,
    switchCamera,
    listDevices,
    status: () => status,
  };
}
