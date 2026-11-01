"use client";

import { useEffect, useRef } from "react";

interface DashboardSlideOverProps {
  resultsSummary: string;
  medicinesSummary: string;
  careTeamSummary: string;
}

const TITLE_MAP: Record<string, string> = {
  results: "Latest results",
  medicines: "My medicines",
  "care-team": "My care team",
};

export function DashboardSlideOver({
  resultsSummary,
  medicinesSummary,
  careTeamSummary,
}: DashboardSlideOverProps) {
  const lastFocusedButtonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    const backdrop = document.getElementById("panel-backdrop");
    const panel = document.getElementById("side-panel");
    const titleEl = document.getElementById("side-panel-title");
    const closeBtn = document.getElementById("side-panel-close");
    const bodyEl = document.getElementById("side-panel-body");

    if (!backdrop || !panel || !titleEl || !closeBtn || !bodyEl) return;

    function openPanel(type: string, triggerBtn: HTMLButtonElement) {
      lastFocusedButtonRef.current = triggerBtn;
      triggerBtn.setAttribute("aria-expanded", "true");

      const title = TITLE_MAP[type] || "Details";
      titleEl!.textContent = title;
      bodyEl!.innerHTML = '<p class="muted">Loading...</p>';

      backdrop!.removeAttribute("hidden");
      panel!.removeAttribute("hidden");
      document.body.style.overflow = "hidden";

      // Move focus into panel
      closeBtn!.focus();

      // Fetch fragment from backend
      fetch(`/panel/${type}`, {
        headers: {
          "X-Requested-With": "XMLHttpRequest",
        },
        cache: "no-store",
      })
        .then(async (res) => {
          if (res.status === 401) {
            window.location.href = "/";
            return;
          }
          if (!res.ok) {
            bodyEl!.innerHTML = `<p class="muted">Unable to load details (${res.status}). Please try again.</p>`;
            return;
          }
          const html = await res.text();
          bodyEl!.innerHTML = html;
        })
        .catch(() => {
          bodyEl!.innerHTML = '<p class="muted">Network error loading details. Please check your connection.</p>';
        });
    }

    function closePanel() {
      backdrop!.setAttribute("hidden", "");
      panel!.setAttribute("hidden", "");
      document.body.style.overflow = "";

      if (lastFocusedButtonRef.current) {
        lastFocusedButtonRef.current.setAttribute("aria-expanded", "false");
        lastFocusedButtonRef.current.focus();
        lastFocusedButtonRef.current = null;
      }
    }

    function handleBtnClick(e: Event) {
      const btn = (e.target as HTMLElement).closest<HTMLButtonElement>("[data-panel]");
      if (!btn) return;
      const type = btn.getAttribute("data-panel");
      if (type) openPanel(type, btn);
    }

    function handleKeyDown(e: KeyboardEvent) {
      if (panel!.hasAttribute("hidden")) return;

      if (e.key === "Escape") {
        e.preventDefault();
        closePanel();
        return;
      }

      // Trap Tab inside #side-panel
      if (e.key === "Tab") {
        const focusables = panel!.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        );
        const focusableArr = Array.from(focusables).filter(
          (el) => !el.hasAttribute("disabled") && el.offsetParent !== null,
        );

        if (focusableArr.length === 0) {
          e.preventDefault();
          return;
        }

        const first = focusableArr[0];
        const last = focusableArr[focusableArr.length - 1];

        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }

    const buttons = document.querySelectorAll<HTMLButtonElement>("[data-panel]");
    buttons.forEach((b) => b.addEventListener("click", handleBtnClick));
    closeBtn.addEventListener("click", closePanel);
    backdrop.addEventListener("click", closePanel);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      buttons.forEach((b) => b.removeEventListener("click", handleBtnClick));
      closeBtn.removeEventListener("click", closePanel);
      backdrop.removeEventListener("click", closePanel);
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, []);

  return (
    <>
      <button
        type="button"
        className="card card-host pane dashboard-panel-btn"
        data-panel="results"
        aria-haspopup="dialog"
        aria-expanded="false"
      >
        <div className="card-head" style={{ marginBottom: 4 }}>
          <h2 id="results-title" style={{ margin: 0, fontSize: "var(--fs-base)" }}>
            Latest results
          </h2>
        </div>
        <span className="muted" style={{ fontSize: "var(--fs-sm)", display: "block" }}>
          {resultsSummary}
        </span>
      </button>

      <button
        type="button"
        className="card card-host pane dashboard-panel-btn"
        data-panel="medicines"
        aria-haspopup="dialog"
        aria-expanded="false"
      >
        <div className="card-head" style={{ marginBottom: 4 }}>
          <h2 id="meds-title" style={{ margin: 0, fontSize: "var(--fs-base)" }}>
            My medicines
          </h2>
        </div>
        <span className="muted" style={{ fontSize: "var(--fs-sm)", display: "block" }}>
          {medicinesSummary}
        </span>
      </button>

      <button
        type="button"
        className="card card-host pane dashboard-panel-btn"
        data-panel="care-team"
        aria-haspopup="dialog"
        aria-expanded="false"
      >
        <div className="card-head" style={{ marginBottom: 4 }}>
          <h2 id="team-title" style={{ margin: 0, fontSize: "var(--fs-base)" }}>
            My care team
          </h2>
        </div>
        <span className="muted" style={{ fontSize: "var(--fs-sm)", display: "block" }}>
          {careTeamSummary}
        </span>
      </button>

      <div id="panel-backdrop" hidden />
      <aside
        id="side-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="side-panel-title"
        hidden
      >
        <header>
          <h2 id="side-panel-title"></h2>
          <button type="button" id="side-panel-close" aria-label="Close">
            ×
          </button>
        </header>
        <div id="side-panel-body" />
      </aside>
    </>
  );
}
