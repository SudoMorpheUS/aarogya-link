"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Building2, Check, ChevronDown, Search, Stethoscope, X } from "lucide-react";
import { grantConsentAction, type FormState } from "@/lib/actions";
import { useActionState } from "react";
import { Notice } from "./ui";

export interface ConsentTarget {
  value: string;
  label: string;
  subtitle?: string;
  type?: "hospital" | "doctor";
  badge?: string;
}

export function GrantConsentForm({
  hospitals,
  doctors,
  today,
}: {
  hospitals: ConsentTarget[];
  doctors: ConsentTarget[];
  today: string;
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(grantConsentAction, {});
  const [selected, setSelected] = useState<ConsentTarget | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<"all" | "hospital" | "doctor">("all");
  const [isOpen, setIsOpen] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const listboxId = useId();

  // Reset selected state on successful grant
  useEffect(() => {
    if (state.ok) {
      setSelected(null);
      setSearchQuery("");
      setIsOpen(false);
    }
  }, [state.ok]);

  // Click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Filter items
  const { filteredHospitals, filteredDoctors, totalMatches } = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    const matchTarget = (item: ConsentTarget) => {
      if (!q) return true;
      return (
        item.label.toLowerCase().includes(q) ||
        (item.subtitle && item.subtitle.toLowerCase().includes(q)) ||
        (item.badge && item.badge.toLowerCase().includes(q)) ||
        item.value.toLowerCase().includes(q)
      );
    };

    const hospMatches: ConsentTarget[] = filterType === "doctor" ? [] : hospitals.filter(matchTarget);
    const docMatches: ConsentTarget[] = filterType === "hospital" ? [] : doctors.filter(matchTarget);

    return {
      filteredHospitals: hospMatches,
      filteredDoctors: docMatches,
      totalMatches: hospMatches.length + docMatches.length,
    };
  }, [hospitals, doctors, searchQuery, filterType]);

  const handleSelect = (item: ConsentTarget) => {
    setSelected(item);
    setIsOpen(false);
    setSearchQuery("");
  };

  const handleClear = () => {
    setSelected(null);
    setSearchQuery("");
    setFilterType("all");
    setIsOpen(true);
    setTimeout(() => searchInputRef.current?.focus(), 50);
  };

  return (
    <form action={action} className="form">
      {/* Hidden input for form submission */}
      <input type="hidden" name="target" value={selected?.value || ""} required />

      <div className="form-row">
        <div className="field field--wide" ref={containerRef} style={{ position: "relative", width: "100%", maxWidth: "100%" }}>
          <label id="target-label" style={{ fontWeight: 600, color: "var(--ink-900)" }}>
            Allow access for
          </label>

          {/* Selected Target View OR Search Input */}
          {selected ? (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "8px 12px",
                border: "2px solid var(--ink-900)",
                borderRadius: "var(--r-input, 6px)",
                background: "var(--white)",
                gap: "10px",
                minHeight: "48px",
                width: "100%",
                maxWidth: "100%",
                boxSizing: "border-box",
                overflow: "hidden",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "10px", minWidth: 0, flex: 1, overflow: "hidden" }}>
                {selected.type === "hospital" || selected.value.startsWith("hospital:") ? (
                  <Building2 size={20} style={{ color: "var(--blue-600)", flexShrink: 0 }} />
                ) : (
                  <Stethoscope size={20} style={{ color: "var(--blue-600)", flexShrink: 0 }} />
                )}
                <div style={{ minWidth: 0, flex: 1, overflow: "hidden" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap", minWidth: 0 }}>
                    <strong style={{ fontSize: "var(--fs-sm)", color: "var(--ink-900)", wordBreak: "break-word" }}>
                      {selected.label}
                    </strong>
                    <span
                      style={{
                        fontSize: "11px",
                        padding: "1px 6px",
                        borderRadius: "4px",
                        background: "var(--blue-50, #242424)",
                        border: "1px solid var(--line)",
                        color: "var(--ink-600)",
                        fontWeight: 600,
                        textTransform: "uppercase",
                        letterSpacing: "0.5px",
                        flexShrink: 0,
                      }}
                    >
                      {selected.type === "hospital" || selected.value.startsWith("hospital:") ? "Hospital" : "Doctor"}
                    </span>
                  </div>
                  {selected.subtitle && (
                    <div
                      className="muted truncate"
                      style={{
                        fontSize: "var(--fs-xs)",
                        marginTop: "2px",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        maxWidth: "100%",
                      }}
                      title={selected.subtitle}
                    >
                      {selected.subtitle}
                    </div>
                  )}
                </div>
              </div>

              <button
                type="button"
                onClick={handleClear}
                className="btn btn--secondary btn--sm"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "4px",
                  padding: "4px 8px",
                  fontSize: "var(--fs-xs)",
                  flexShrink: 0,
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                }}
                title="Change selected hospital or doctor"
              >
                <X size={14} />
                Change
              </button>
            </div>
          ) : (
            <div style={{ position: "relative" }}>
              <div
                style={{
                  position: "relative",
                  display: "flex",
                  alignItems: "center",
                }}
              >
                <Search
                  size={18}
                  style={{
                    position: "absolute",
                    left: "12px",
                    color: "var(--ink-400, #888)",
                    pointerEvents: "none",
                  }}
                />
                <input
                  ref={searchInputRef}
                  type="text"
                  role="combobox"
                  aria-expanded={isOpen}
                  aria-controls={listboxId}
                  aria-labelledby="target-label"
                  placeholder={`Search ${hospitals.length} hospitals or ${doctors.length} doctors by name, specialty, or city…`}
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    if (!isOpen) setIsOpen(true);
                  }}
                  onFocus={() => setIsOpen(true)}
                  style={{
                    paddingLeft: "38px",
                    paddingRight: searchQuery ? "64px" : "36px",
                    width: "100%",
                    minHeight: "46px",
                    border: isOpen ? "2px solid var(--blue-600)" : "1px solid var(--line)",
                  }}
                />
                {searchQuery ? (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery("");
                      setFilterType("all");
                      searchInputRef.current?.focus();
                    }}
                    style={{
                      position: "absolute",
                      right: "32px",
                      background: "transparent",
                      border: "none",
                      color: "var(--ink-400)",
                      cursor: "pointer",
                      padding: "4px",
                    }}
                    title="Clear search"
                  >
                    <X size={16} />
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => setIsOpen((prev) => !prev)}
                  style={{
                    position: "absolute",
                    right: "10px",
                    background: "transparent",
                    border: "none",
                    color: "var(--ink-400)",
                    cursor: "pointer",
                    padding: "4px",
                    display: "flex",
                    alignItems: "center",
                  }}
                  aria-label="Toggle dropdown"
                >
                  <ChevronDown
                    size={16}
                    style={{
                      transform: isOpen ? "rotate(180deg)" : "none",
                      transition: "transform 150ms ease",
                    }}
                  />
                </button>
              </div>

              {/* Filter Tabs */}
              <div
                style={{
                  display: "flex",
                  gap: "6px",
                  marginTop: "6px",
                  alignItems: "center",
                }}
              >
                <span className="muted" style={{ fontSize: "var(--fs-xs)", marginRight: "2px" }}>
                  Filter:
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setFilterType("all");
                    if (!isOpen) setIsOpen(true);
                  }}
                  style={{
                    fontSize: "var(--fs-xs)",
                    padding: "3px 8px",
                    borderRadius: "4px",
                    border: "1px solid",
                    borderColor: filterType === "all" ? "var(--ink-900)" : "var(--line)",
                    background: filterType === "all" ? "var(--ink-900)" : "transparent",
                    color: filterType === "all" ? "var(--white-soft, #fff)" : "var(--ink-600)",
                    cursor: "pointer",
                    fontWeight: 500,
                  }}
                >
                  All ({hospitals.length + doctors.length})
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setFilterType("hospital");
                    if (!isOpen) setIsOpen(true);
                  }}
                  style={{
                    fontSize: "var(--fs-xs)",
                    padding: "3px 8px",
                    borderRadius: "4px",
                    border: "1px solid",
                    borderColor: filterType === "hospital" ? "var(--ink-900)" : "var(--line)",
                    background: filterType === "hospital" ? "var(--ink-900)" : "transparent",
                    color: filterType === "hospital" ? "var(--white-soft, #fff)" : "var(--ink-600)",
                    cursor: "pointer",
                    fontWeight: 500,
                  }}
                >
                  Hospitals ({hospitals.length})
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setFilterType("doctor");
                    if (!isOpen) setIsOpen(true);
                  }}
                  style={{
                    fontSize: "var(--fs-xs)",
                    padding: "3px 8px",
                    borderRadius: "4px",
                    border: "1px solid",
                    borderColor: filterType === "doctor" ? "var(--ink-900)" : "var(--line)",
                    background: filterType === "doctor" ? "var(--ink-900)" : "transparent",
                    color: filterType === "doctor" ? "var(--white-soft, #fff)" : "var(--ink-600)",
                    cursor: "pointer",
                    fontWeight: 500,
                  }}
                >
                  Doctors ({doctors.length})
                </button>
              </div>

              {/* Dropdown Menu */}
              {isOpen && (
                <div
                  id={listboxId}
                  role="listbox"
                  style={{
                    position: "absolute",
                    top: "calc(100% + 4px)",
                    left: 0,
                    right: 0,
                    zIndex: 60,
                    maxHeight: "320px",
                    overflowY: "auto",
                    background: "var(--white, #1c1c1c)",
                    border: "2px solid var(--line, #444)",
                    borderRadius: "var(--r-card, 8px)",
                    boxShadow: "var(--shadow-2, 0 8px 24px rgba(0,0,0,0.4))",
                    padding: "6px",
                  }}
                >
                  {totalMatches === 0 ? (
                    <div style={{ padding: "16px", textAlign: "center", color: "var(--ink-600)" }}>
                      <p style={{ margin: 0, fontWeight: 500 }}>No results found</p>
                      <p style={{ margin: "4px 0 0", fontSize: "var(--fs-xs)" }} className="muted">
                        No hospital or doctor matched &ldquo;{searchQuery}&rdquo;
                      </p>
                    </div>
                  ) : (
                    <>
                      {/* Hospitals Group */}
                      {filteredHospitals.length > 0 && (
                        <div style={{ marginBottom: filteredDoctors.length > 0 ? "8px" : 0 }}>
                          <div
                            style={{
                              padding: "6px 10px 4px",
                              fontSize: "11px",
                              fontWeight: 700,
                              textTransform: "uppercase",
                              letterSpacing: "0.5px",
                              color: "var(--blue-600)",
                              display: "flex",
                              alignItems: "center",
                              gap: "6px",
                            }}
                          >
                            <Building2 size={13} />
                            Hospitals ({filteredHospitals.length})
                          </div>
                          {filteredHospitals.map((h: ConsentTarget) => (
                            <div
                              key={h.value}
                              role="option"
                              aria-selected={false}
                              tabIndex={0}
                              onClick={() => handleSelect(h)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter" || e.key === " ") {
                                  e.preventDefault();
                                  handleSelect(h);
                                }
                              }}
                              style={{
                                padding: "8px 10px",
                                borderRadius: "4px",
                                cursor: "pointer",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                                gap: "8px",
                                transition: "background 100ms ease",
                              }}
                              onMouseEnter={(e) => (e.currentTarget.style.background = "var(--blue-50, #242424)")}
                              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                            >
                              <div style={{ minWidth: 0 }}>
                                <div style={{ fontWeight: 600, fontSize: "var(--fs-sm)", color: "var(--ink-900)" }}>
                                  {h.label}
                                </div>
                                {h.subtitle && (
                                  <div className="muted truncate" style={{ fontSize: "var(--fs-xs)" }}>
                                    {h.subtitle}
                                  </div>
                                )}
                              </div>
                              <span
                                style={{
                                  fontSize: "10px",
                                  padding: "2px 6px",
                                  borderRadius: "4px",
                                  background: "var(--blue-100, #181818)",
                                  border: "1px solid var(--line)",
                                  color: "var(--ink-600)",
                                  flexShrink: 0,
                                }}
                              >
                                Whole hospital
                              </span>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Doctors Group */}
                      {filteredDoctors.length > 0 && (
                        <div>
                          <div
                            style={{
                              padding: "6px 10px 4px",
                              fontSize: "11px",
                              fontWeight: 700,
                              textTransform: "uppercase",
                              letterSpacing: "0.5px",
                              color: "var(--blue-600)",
                              display: "flex",
                              alignItems: "center",
                              gap: "6px",
                              borderTop: filteredHospitals.length > 0 ? "1px solid var(--line)" : "none",
                              paddingTop: filteredHospitals.length > 0 ? "8px" : "6px",
                            }}
                          >
                            <Stethoscope size={13} />
                            Doctors ({filteredDoctors.length})
                          </div>
                          {filteredDoctors.map((d: ConsentTarget) => (
                            <div
                              key={d.value}
                              role="option"
                              aria-selected={false}
                              tabIndex={0}
                              onClick={() => handleSelect(d)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter" || e.key === " ") {
                                  e.preventDefault();
                                  handleSelect(d);
                                }
                              }}
                              style={{
                                padding: "8px 10px",
                                borderRadius: "4px",
                                cursor: "pointer",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                                gap: "8px",
                                transition: "background 100ms ease",
                              }}
                              onMouseEnter={(e) => (e.currentTarget.style.background = "var(--blue-50, #242424)")}
                              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                            >
                              <div style={{ minWidth: 0 }}>
                                <div style={{ fontWeight: 600, fontSize: "var(--fs-sm)", color: "var(--ink-900)" }}>
                                  {d.label}
                                </div>
                                {d.subtitle && (
                                  <div className="muted truncate" style={{ fontSize: "var(--fs-xs)" }}>
                                    {d.subtitle}
                                  </div>
                                )}
                              </div>
                              <span
                                style={{
                                  fontSize: "10px",
                                  padding: "2px 6px",
                                  borderRadius: "4px",
                                  background: "var(--blue-100, #181818)",
                                  border: "1px solid var(--line)",
                                  color: "var(--ink-600)",
                                  flexShrink: 0,
                                }}
                              >
                                {d.badge || "Doctor"}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        <label className="field">
          From
          <input type="date" name="start_date" defaultValue={today} required />
        </label>
        <label className="field">
          Until (optional)
          <input type="date" name="end_date" min={today} />
        </label>
      </div>

      {state.error ? <Notice tone="error">{state.error}</Notice> : null}
      {state.ok ? <Notice>{state.ok}</Notice> : null}

      <div>
        <button className="btn" disabled={pending || !selected}>
          {pending ? "Granting…" : "Grant consent"}
        </button>
        {!selected && !pending && (
          <span className="muted" style={{ marginLeft: "12px", fontSize: "var(--fs-xs)" }}>
            Select a hospital or doctor above to grant consent
          </span>
        )}
      </div>
    </form>
  );
}
