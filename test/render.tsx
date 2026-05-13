import { render, type RenderOptions } from "@testing-library/react";
import type { ReactElement } from "react";
import { vi } from "vitest";

import { AppRole, type User } from "@/types";

export function testUser(overrides: Partial<User> = {}): User {
  return {
    id: "user-1",
    name: "Admin",
    email: "admin@example.com",
    role: AppRole.ADMIN,
    ...overrides,
  };
}

export function renderWithProviders(
  ui: ReactElement,
  options?: RenderOptions,
) {
  return render(ui, options);
}

export function mockRouter() {
  return {
    push: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
  };
}
