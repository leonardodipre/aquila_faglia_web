import "@testing-library/jest-dom/vitest";
import { createElement, forwardRef } from "react";
import { vi } from "vitest";

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

vi.stubGlobal("ResizeObserver", ResizeObserverStub);

vi.mock("uplot", () => {
  return {
    default: class UPlotMock {
      constructor() {}
      destroy() {}
    },
  };
});

vi.mock("leaflet", () => {
  const bounds = {
    isValid: () => true,
    pad: () => bounds,
  };
  return {
    default: {
      latLngBounds: () => bounds,
      geoJSON: () => ({
        getBounds: () => bounds,
      }),
    },
  };
});

vi.mock("react-leaflet", () => {
  return {
    MapContainer: ({ children }: { children: unknown }) => createElement("div", { "data-testid": "map" }, children),
    TileLayer: () => null,
    GeoJSON: () => null,
    CircleMarker: ({
      eventHandlers,
      center,
    }: {
      eventHandlers?: { click?: () => void };
      center: [number, number];
    }) =>
      createElement("button", {
        type: "button",
        "data-testid": `marker-${center[0]}-${center[1]}`,
        onClick: () => eventHandlers?.click?.(),
      }),
    useMap: () => ({
      fitBounds: vi.fn(),
    }),
  };
});

vi.mock("@react-three/fiber", () => {
  return {
    Canvas: () => createElement("div", { "data-testid": "fault-canvas" }),
    useThree: () => ({
      camera: {
        position: { set: vi.fn() },
        up: { set: vi.fn() },
        lookAt: vi.fn(),
        updateProjectionMatrix: vi.fn(),
      },
    }),
  };
});

vi.mock("@react-three/drei", () => {
  return {
    Line: () => null,
    OrbitControls: forwardRef(function OrbitControlsMock(_, __) {
      return null;
    }),
  };
});
