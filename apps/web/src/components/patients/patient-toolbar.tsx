import { ChevronDown, Search } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState } from "react";

import type { PatientsFilter } from "./patient-types";
import styles from "./patients-page.module.css";

interface PatientToolbarProps {
  searchValue: string;
  onSearchChange: (value: string) => void;
  filterValue: PatientsFilter;
  onFilterChange: (value: PatientsFilter) => void;
  patientCount: number;
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
  patientCount,
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
      if (!(target instanceof Node)) return;
      if (!filterWrapRef.current?.contains(target)) setIsFilterOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsFilterOpen(false);
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
        <span className={styles.patientCount}>
          {patientCount} patient{patientCount !== 1 ? "s" : ""}
        </span>
      </div>

      <div className={styles.toolbarRight}>
        <label className={styles.searchWrap}>
          <Search size={15} className={styles.searchIcon} aria-hidden="true" />
          <input
            type="search"
            className={styles.searchInput}
            value={searchValue}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Rechercher un patient..."
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
            onClick={() => setIsFilterOpen((o) => !o)}
          >
            <span className={styles.filterTriggerLabel}>{activeFilterLabel}</span>
            <ChevronDown
              size={15}
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
                      className={`${styles.filterOptionButton} ${isSelected ? styles.filterOptionButtonActive : ""}`}
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
