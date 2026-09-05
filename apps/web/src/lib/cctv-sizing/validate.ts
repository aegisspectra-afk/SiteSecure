import type { CctvSizingInput, ValidationIssue } from "./types";

/**
 * Validate CCTV sizing input. No silent correction.
 */
export function validateCctvSizingInput(input: CctvSizingInput): ValidationIssue[] {
  const errors: ValidationIssue[] = [];
  const count = input.cameraCount;

  if (!Number.isFinite(count) || !Number.isInteger(count)) {
    errors.push({
      code: "INPUT_VALIDATION_ERROR",
      field: "cameraCount",
      message: "cameraCount must be a finite integer",
    });
  } else if (count < 0) {
    errors.push({
      code: "INPUT_VALIDATION_ERROR",
      field: "cameraCount",
      message: "cameraCount cannot be negative",
    });
  } else if (count === 0) {
    errors.push({
      code: "INPUT_VALIDATION_ERROR",
      field: "cameraCount",
      message: "cameraCount must be at least 1",
    });
  }

  const indoor = input.indoorCount;
  const outdoor = input.outdoorCount;
  if (indoor != null || outdoor != null) {
    if (indoor != null && (!Number.isFinite(indoor) || indoor < 0 || !Number.isInteger(indoor))) {
      errors.push({
        code: "INPUT_VALIDATION_ERROR",
        field: "indoorCount",
        message: "indoorCount must be a non-negative integer",
      });
    }
    if (outdoor != null && (!Number.isFinite(outdoor) || outdoor < 0 || !Number.isInteger(outdoor))) {
      errors.push({
        code: "INPUT_VALIDATION_ERROR",
        field: "outdoorCount",
        message: "outdoorCount must be a non-negative integer",
      });
    }
    if (
      indoor != null &&
      outdoor != null &&
      Number.isInteger(count) &&
      count > 0 &&
      indoor + outdoor !== count
    ) {
      errors.push({
        code: "INPUT_VALIDATION_ERROR",
        field: "indoorCount+outdoorCount",
        message: "indoorCount + outdoorCount must equal cameraCount",
      });
    }
  }

  if (input.retentionDays != null) {
    if (!Number.isFinite(input.retentionDays) || input.retentionDays <= 0) {
      errors.push({
        code: "INPUT_VALIDATION_ERROR",
        field: "retentionDays",
        message: "retentionDays must be > 0",
      });
    }
  }

  if (input.bitrateMbpsOverride != null && !(input.bitrateMbpsOverride > 0)) {
    errors.push({
      code: "INPUT_VALIDATION_ERROR",
      field: "bitrateMbpsOverride",
      message: "bitrateMbpsOverride must be > 0",
    });
  }

  if (input.bitrateMbps != null && !(input.bitrateMbps > 0)) {
    errors.push({
      code: "INPUT_VALIDATION_ERROR",
      field: "bitrateMbps",
      message: "bitrateMbps must be > 0",
    });
  }

  if (input.expansionHeadroom != null) {
    if (!Number.isFinite(input.expansionHeadroom) || input.expansionHeadroom < 0) {
      errors.push({
        code: "INPUT_VALIDATION_ERROR",
        field: "expansionHeadroom",
        message: "expansionHeadroom must be ≥ 0",
      });
    }
  }

  if (input.motionDutyCycle != null) {
    if (!Number.isFinite(input.motionDutyCycle) || input.motionDutyCycle <= 0 || input.motionDutyCycle > 1) {
      errors.push({
        code: "INPUT_VALIDATION_ERROR",
        field: "motionDutyCycle",
        message: "motionDutyCycle must be in (0, 1]",
      });
    }
  }

  if (input.recordingHoursPerDay != null) {
    if (
      !Number.isFinite(input.recordingHoursPerDay) ||
      input.recordingHoursPerDay <= 0 ||
      input.recordingHoursPerDay > 24
    ) {
      errors.push({
        code: "INPUT_VALIDATION_ERROR",
        field: "recordingHoursPerDay",
        message: "recordingHoursPerDay must be in (0, 24]",
      });
    }
  }

  return errors;
}
