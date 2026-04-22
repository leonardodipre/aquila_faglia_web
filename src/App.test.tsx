import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

vi.mock("./pages/OverviewPage", () => ({
  OverviewPage: () => <div>Overview Mock</div>,
}));

vi.mock("./pages/ModelsPage", () => ({
  ModelsPage: () => <div>Models Mock</div>,
}));
vi.mock("./pages/ReadmePage", () => ({
  ReadmePage: () => <div>Readme Mock</div>,
}));

import { App } from "./App";

describe("App routes", () => {
  it("renders the overview route", async () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <App />
      </MemoryRouter>,
    );

    expect(await screen.findByText("Overview Mock")).toBeInTheDocument();
  });

  it("renders the models route", async () => {
    render(
      <MemoryRouter initialEntries={["/modelli"]}>
        <App />
      </MemoryRouter>,
    );

    expect(await screen.findByText("Models Mock")).toBeInTheDocument();
  });

  it("renders the readme route", async () => {
    render(
      <MemoryRouter initialEntries={["/readme"]}>
        <App />
      </MemoryRouter>,
    );

    expect(await screen.findByText("Readme Mock")).toBeInTheDocument();
  });
});
