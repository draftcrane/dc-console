import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import DashboardPage from "@/app/(protected)/dashboard/page";

const mockPush = vi.fn();
const mockUseProjectActions = vi.fn();
const mockFetchProjects = vi.fn();
const mockClearProjectsError = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
    replace: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  }),
}));

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...props
  }: {
    href: string;
    children: React.ReactNode;
  } & React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("@clerk/nextjs", () => ({
  useAuth: () => ({
    getToken: vi.fn().mockResolvedValue("token"),
  }),
}));

vi.mock("@/hooks/use-sign-out", () => ({
  useSignOut: () => ({
    handleSignOut: vi.fn(),
    isSigningOut: false,
  }),
}));

vi.mock("@/hooks/use-backup", () => ({
  useBackup: () => ({
    importBackup: vi.fn(),
    isImporting: false,
    error: null,
  }),
}));

vi.mock("@/hooks/use-project-actions", () => ({
  useProjectActions: () => mockUseProjectActions(),
}));

vi.mock("@/components/project/delete-project-dialog", () => ({
  DeleteProjectDialog: () => null,
}));

describe("DashboardPage", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mockPush.mockClear();
    mockFetchProjects.mockClear();
    mockClearProjectsError.mockClear();

    mockUseProjectActions.mockReturnValue({
      projects: [],
      isLoadingProjects: false,
      projectsError: "Failed to load projects",
      clearProjectsError: mockClearProjectsError,
      fetchProjects: mockFetchProjects,
      renameProject: vi.fn(),
      isRenaming: false,
      duplicateProject: vi.fn(),
      isDuplicating: false,
    });
  });

  it("shows an error state instead of zero-project onboarding when project fetch fails", () => {
    render(<DashboardPage />);

    expect(screen.getByText("Failed to load projects")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Try Again" })).toBeInTheDocument();
    expect(screen.queryByText("Welcome to DraftCrane")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Try Again" }));
    expect(mockClearProjectsError).toHaveBeenCalledTimes(1);
    expect(mockFetchProjects).toHaveBeenCalledTimes(1);
  });
});
