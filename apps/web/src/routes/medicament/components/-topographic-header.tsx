import type { CSSProperties } from "react";
import { Plus } from "lucide-react";

import headerTexture from "@/assets/figma/patients/fc145d0d9403ead31e8bc198dd8335751de59305.svg";

import { MEDICATIONS_PAGE_TEXT } from "./-page-data";

export function TopographicHeader({
  subtitle,
  onAdd,
}: {
  subtitle: string;
  onAdd: () => void;
}) {
  return (
    <section
      aria-labelledby="medicaments-page-title"
      style={{
        position: "relative",
        overflow: "hidden",
        height: "clamp(7.15rem, 12.8vh, 8.4rem)",
        borderRadius: "0.9375rem",
        border: "1px solid color-mix(in srgb, #c2e0ef 68%, white)",
        background:
          "linear-gradient(97.5deg, color-mix(in srgb, #c2e0ef 87%, white 13%) 0%, #ffffff 99.9%)",
        boxShadow: "0 0.25rem 1.25rem rgba(118, 187, 221, 0.5)",
        padding: "clamp(0.65rem, 1.35vh, 1rem) clamp(1rem, 2vw, 1.5rem)",
      } as CSSProperties}
    >
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          left: "-5%",
          right: "-9%",
          top: "-205%",
          bottom: "-70%",
          pointerEvents: "none",
          opacity: 0.2,
          backgroundImage: `url(${headerTexture})`,
          backgroundRepeat: "no-repeat",
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      />

      <div
        style={{
          position: "relative",
          zIndex: 1,
          display: "flex",
          height: "100%",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "1rem",
        }}
      >
        <div style={{ minWidth: 0 }}>
          <h1
            id="medicaments-page-title"
            style={{
              margin: 0,
              color: "#0f3460",
              fontSize: "clamp(1.28rem, 2.12vw, 1.78rem)",
              lineHeight: 1.1,
              fontWeight: 700,
            }}
          >
            {MEDICATIONS_PAGE_TEXT.title}
          </h1>
          <p
            style={{
              margin: "0.18rem 0 0",
              color: "#052ca0",
              fontSize: "clamp(0.88rem, 1.22vw, 1.06rem)",
              lineHeight: 1.2,
              fontWeight: 600,
            }}
          >
            {subtitle}
          </p>
        </div>

        <button
          type="button"
          onClick={onAdd}
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "0.65rem",
            height: "2.625rem",
            minWidth: "13.5rem",
            padding: "0 1.5rem",
            border: 0,
            borderRadius: "0.875rem",
            background: "#052ca0",
            color: "#ffffff",
            fontSize: "1rem",
            fontWeight: 600,
            letterSpacing: "-0.01em",
            whiteSpace: "nowrap",
            cursor: "pointer",
            boxShadow: "0px 4px 12px rgba(5, 44, 160, 0.38)",
            flexShrink: 0,
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = "#0a3ac7";
            (e.currentTarget as HTMLButtonElement).style.boxShadow = "0px 8px 20px rgba(5, 44, 160, 0.44)";
            (e.currentTarget as HTMLButtonElement).style.transform = "translateY(-1px)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = "#052ca0";
            (e.currentTarget as HTMLButtonElement).style.boxShadow = "0px 4px 12px rgba(5, 44, 160, 0.38)";
            (e.currentTarget as HTMLButtonElement).style.transform = "";
          }}
        >
          <Plus size={20} strokeWidth={2.5} aria-hidden="true" />
          Ajouter un médicament
        </button>
      </div>
    </section>
  );
}
