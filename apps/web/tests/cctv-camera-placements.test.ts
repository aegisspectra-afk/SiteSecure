import { describe, expect, it } from "vitest";
import { defaultCctvBuildRequirements, requirementsToRecommendBody } from "../src/lib/cctv-build-requirements";
import {
  addPlacement,
  derivePlacementAggregates,
  newCameraPlacement,
  updatePlacement,
} from "../src/lib/cctv-camera-placements";

describe("B4 camera placements", () => {
  it("derives indoor/outdoor and total from rows", () => {
    const agg = derivePlacementAggregates([
      newCameraPlacement({ label: "כניסה", count: 2, environment: "outdoor", formFactor: "bullet" }),
      newCameraPlacement({ label: "לובי", count: 3, environment: "indoor", formFactor: "dome" }),
    ]);
    expect(agg).toEqual({
      cameraCount: 5,
      indoorCount: 3,
      outdoorCount: 2,
      environment: "indoor_outdoor",
      formFactor: "",
    });
  });

  it("keeps unanimous form factor", () => {
    const agg = derivePlacementAggregates([
      newCameraPlacement({ count: 2, environment: "indoor", formFactor: "dome" }),
      newCameraPlacement({ count: 1, environment: "indoor", formFactor: "dome" }),
    ]);
    expect(agg?.formFactor).toBe("dome");
    expect(agg?.environment).toBe("indoor");
  });

  it("feeds indoor_count/outdoor_count into recommend body", () => {
    let req = defaultCctvBuildRequirements();
    req = addPlacement(req, { label: "חניה", count: 4, environment: "outdoor", formFactor: "bullet" });
    req = addPlacement(req, { label: "משרד", count: 2, environment: "indoor", formFactor: "bullet" });
    const body = requirementsToRecommendBody(req);
    expect(body.camera_count).toBe(6);
    expect(body.indoor_count).toBe(2);
    expect(body.outdoor_count).toBe(4);
    expect(body.environment).toBe("indoor_outdoor");
    expect(body.form_factor).toBe("bullet");
  });

  it("updates aggregates when editing a row", () => {
    let req = defaultCctvBuildRequirements();
    req = addPlacement(req, { label: "כניסה", count: 1, environment: "outdoor" });
    const id = req.cameraPlacements[0]!.id;
    req = updatePlacement(req, id, { count: 5 });
    expect(req.cameraCount).toBe(5);
    expect(req.environment).toBe("outdoor");
  });
});
