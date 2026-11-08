const legacyTemplate = {
  version: "openhouse-2027-v1",
  width: 2000,
  height: 1414,
  background: {
    key: "templates/openhouse-2027-v1/background.png",
    sha256: "e196e52731fe421c47f502a2c26ce41441322e2fb9dd0d800e0ac9e0f1d9abe8",
  },
  font: {
    key: "templates/openhouse-2027-v1/Sarabun-Regular.ttf",
    sha256: "b8150084e25734e6f31696c57ff009f5564efa09d295848b717d9e2328c0311d",
  },
  // Coordinates in original PNG pixels. White cover leaves separator at y=784 intact.
  name: { x: 300, y: 600, width: 1400, height: 160, maxFont: 112, minFont: 48 },
  qr: { x: 80, y: 1110, size: 248, quietZone: 4, minimumModuleMm: 0.3 },
} as const;

// The organizer's updated artwork removes the baked-in sample name and revises the logo.
// Preserve v1 references for certificates already issued in local/preview environments.
const artworkTemplate = {
  ...legacyTemplate,
  version: "openhouse-2027-v2",
  background: {
    key: "templates/openhouse-2027-v2/background.png",
    sha256: "25043cf167cd2f771a8a43cb4fcffb8c6e3822aabb4ab9680bde1c6bd4725fe9",
  },
  font: {
    ...legacyTemplate.font,
    key: "templates/openhouse-2027-v2/Sarabun-Regular.ttf",
  },
} as const;
// Layout revision: keep the full signed URL copyable/clickable beside the QR.
export const CERTIFICATE_TEMPLATE = {
  ...artworkTemplate,
  version: "openhouse-2027-v3",
  finePrint: {
    x: 360,
    y: 1280,
    width: 1580,
    height: 110,
    fontSize: 14,
    lineHeight: 17,
  },
} as const;
export function certificateTemplate(version: string) {
  if (version === legacyTemplate.version) return legacyTemplate;
  if (version === artworkTemplate.version) return artworkTemplate;
  if (version === CERTIFICATE_TEMPLATE.version) return CERTIFICATE_TEMPLATE;
  throw new Error("Unknown certificate template version");
}
