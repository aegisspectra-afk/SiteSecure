import { Button } from "@site-secure/ui";
import { useEffect, useRef, useState } from "react";
import { he } from "../i18n/he";
import {
  cameraScanSupported,
  createCameraQr,
  type CameraQrController,
  type CameraQrStatus,
} from "../lib/cameraQr";

export function QrScanner({
  paused,
  onCode,
}: {
  paused: boolean;
  onCode: (code: string) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const ctlRef = useRef<CameraQrController | null>(null);
  const pausedRef = useRef(paused);
  const onCodeRef = useRef(onCode);
  pausedRef.current = paused;
  onCodeRef.current = onCode;
  const [status, setStatus] = useState<CameraQrStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [canSwitch, setCanSwitch] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const ctl = createCameraQr({
      video,
      onCode: (value) => onCodeRef.current(value),
      isPaused: () => pausedRef.current,
      onStatus: (next, err) => {
        setStatus(next);
        setError(err ?? null);
      },
    });
    ctlRef.current = ctl;
    return () => {
      ctl.stop();
      ctlRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (status !== "live") {
      setCanSwitch(false);
      return;
    }
    void ctlRef.current?.listDevices().then((devs) => setCanSwitch(devs.length > 1));
  }, [status]);

  const start = () => {
    void ctlRef.current?.start();
  };

  if (!cameraScanSupported() && status === "idle") {
    return (
      <p className="rounded-md border border-border px-3 py-3 text-sm text-fg-muted" data-testid="ssp-scan-unsupported">
        {he.scanCameraUnsupported}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3" data-testid="ssp-qr-scanner">
      <div className="relative overflow-hidden rounded-lg border border-border bg-black">
        <video
          ref={videoRef}
          className="aspect-[3/4] w-full object-cover sm:aspect-video"
          playsInline
          muted
          autoPlay
        />
        {status === "starting" ? (
          <p className="absolute inset-0 grid place-items-center bg-black/50 text-sm text-white">{he.scanCameraLoading}</p>
        ) : null}
        {status === "live" && !paused ? (
          <span className="absolute start-3 top-3 rounded-full bg-black/55 px-2 py-1 text-[11px] text-white">
            {he.scanLive}
          </span>
        ) : null}
      </div>
      <div className="flex flex-wrap gap-2">
        {status === "live" ? (
          <Button type="button" variant="secondary" onClick={() => ctlRef.current?.stop()}>
            {he.scanCameraStop}
          </Button>
        ) : (
          <Button type="button" onClick={start} disabled={status === "starting"}>
            {status === "starting" ? he.scanCameraLoading : he.scanCameraStart}
          </Button>
        )}
        {status === "live" && canSwitch ? (
          <Button type="button" variant="secondary" onClick={() => void ctlRef.current?.switchCamera()}>
            {he.scanCameraSwitch}
          </Button>
        ) : null}
      </div>
      {status === "denied" ? (
        <p className="text-sm text-danger" role="alert" data-testid="ssp-scan-denied">
          {he.scanCameraDenied}
        </p>
      ) : null}
      {status === "unsupported" ? (
        <p className="text-sm text-fg-muted" data-testid="ssp-scan-unsupported">
          {he.scanCameraUnsupported}
        </p>
      ) : null}
      {status === "error" && error ? (
        <p className="text-sm text-danger" role="alert">
          {he.scanCameraError}: {error}
        </p>
      ) : null}
    </div>
  );
}
