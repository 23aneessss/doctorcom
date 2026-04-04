import { ChevronDown, LayoutGrid, List, Search } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState } from "react";

import type { PatientsFilter, PatientsViewMode } from "./patient-types";
import styles from "./patients-page.module.css";

interface PatientToolbarProps {
  searchValue: string;
  onSearchChange: (value: string) => void;
  filterValue: PatientsFilter;
  onFilterChange: (value: PatientsFilter) => void;
  viewMode: PatientsViewMode;
  onViewModeChange: (value: PatientsViewMode) => void;
  onShowAll: () => void;
}

const FILTER_OPTIONS: Array<{ value: PatientsFilter; label: string }> = [
  { value: "all", label: "Filtrer par" },
  { value: "female", label: "Femmes" },
  { value: "male", label: "Hommes" },
  { value: "other", label: "Autres" },
];

export function PatientToolbar({
  searchValue,
  onSearchChange,
  filterValue,
  onFilterChange,
  viewMode,
  onViewModeChange,
  onShowAll,
}: PatientToolbarProps) {
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const filterWrapRef = useRef<HTMLDivElement | null>(null);
  const filterDropdownId = useId();

  const activeFilterLabel = useMemo(() => {
    return FILTER_OPTIONS.find((option) => option.value === filterValue)?.label ?? "Filtrer par";
  }, [filterValue]);

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) {
        return;
      }

      if (!filterWrapRef.current?.contains(target)) {
        setIsFilterOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsFilterOpen(false);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  return (
    <section className={styles.toolbar} aria-label="Patients toolbar">
      <div className={styles.toolbarLeft}>
        <button type="button" className={styles.seeAllButton} onClick={onShowAll}>
          Voir tout
        </button>

        <div className={styles.viewModeGroup} role="group" aria-label="Mode d'affichage">
          <button
            type="button"
            className={`${styles.viewModeButton} ${
              viewMode === "vertical" ? styles.viewModeButtonActive : ""
            }`}
            aria-label="Affichage vertical"
            aria-pressed={viewMode === "vertical"}
            onClick={() => onViewModeChange("vertical")}
          >
            <List size={16} aria-hidden="true" />
          </button>

          <button
            type="button"
            className={`${styles.viewModeButton} ${
              viewMode === "horizontal" ? styles.viewModeButtonActive : ""
            }`}
            aria-label="Affichage horizontal"
            aria-pressed={viewMode === "horizontal"}
            onClick={() => onViewModeChange("horizontal")}
          >
            <LayoutGrid size={16} aria-hidden="true" />
          </button>
        </div>
      </div>

      <div className={styles.toolbarRight}>
        <label className={styles.searchWrap}>
          <Search size={16} className={styles.searchIcon} aria-hidden="true" />
          <input
            type="search"
            className={styles.searchInput}
            value={searchValue}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Recherche patient"
            aria-label="Recherche patient"
          />
        </label>

        <div className={styles.filterWrap} ref={filterWrapRef}>
          <button
            type="button"
            className={`${styles.filterTrigger} ${isFilterOpen ? styles.filterTriggerOpen : ""}`}
            aria-haspopup="listbox"
            aria-expanded={isFilterOpen}
            aria-controls={filterDropdownId}
            onClick={() => setIsFilterOpen((currentOpen) => !currentOpen)}
          >
            <span className={styles.filterTriggerLabel}>{activeFilterLabel}</span>
            <ChevronDown
              size={16}
              className={`${styles.filterChevron} ${isFilterOpen ? styles.filterChevronOpen : ""}`}
              aria-hidden="true"
            />
          </button>

          {isFilterOpen ? (
            <ul id={filterDropdownId} className={styles.filterDropdown} role="listbox" aria-label="Filtrer par">
              {FILTER_OPTIONS.map((option) => {
                const isSelected = filterValue === option.value;

                return (
                  <li key={option.value} className={styles.filterOptionItem}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      className={`${styles.filterOptionButton} ${
                        isSelected ? styles.filterOptionButtonActive : ""
                      }`}
                      onClick={() => {
                        onFilterChange(option.value);
                        setIsFilterOpen(false);
                      }}
                    >
                      {option.label}
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : null}
        </div>
      </div>
    </section>
  );
}
