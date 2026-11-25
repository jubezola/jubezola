import type { SVGProps } from "react";

/** Conjunto de ícones próprio: grelha 24×24, traço 1.6, cantos redondos. Decorativos por defeito (aria-hidden). */
type P = SVGProps<SVGSVGElement> & { size?: number };

function Base({ size = 22, children, ...rest }: P & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {children}
    </svg>
  );
}

export const IconWhatsApp = (p: P) => (
  <Base {...p}>
    <path d="M4.2 19.8 5.3 16A8.2 8.2 0 1 1 8.4 19z" />
    <path d="M9.2 8.6c.2-.5.5-.6.8-.6h.5c.2 0 .4.1.5.4l.6 1.5c.1.2 0 .5-.1.6l-.5.6c.6 1.2 1.5 2.1 2.7 2.7l.6-.5c.2-.2.4-.2.6-.1l1.5.6c.3.1.4.3.4.5v.5c0 .3-.1.6-.6.8-.6.3-1.6.5-3.1-.2a8.3 8.3 0 0 1-3.8-3.8c-.7-1.5-.5-2.5-.1-3.1z" />
  </Base>
);

export const IconPhone = (p: P) => (
  <Base {...p}>
    <path d="M6.6 3.5h2.3l1.4 4-2 1.3a11 11 0 0 0 6.9 6.9l1.3-2 4 1.4v2.3a2 2 0 0 1-2.2 2A16.5 16.5 0 0 1 4.6 5.7a2 2 0 0 1 2-2.2z" />
  </Base>
);

export const IconClock = (p: P) => (
  <Base {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 7.5V12l3 2" />
  </Base>
);

export const IconPin = (p: P) => (
  <Base {...p}>
    <path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z" />
    <circle cx="12" cy="10" r="2.4" />
  </Base>
);

export const IconArrowRight = (p: P) => (
  <Base {...p}>
    <path d="M5 12h14M13 6l6 6-6 6" />
  </Base>
);

export const IconArrowUpRight = (p: P) => (
  <Base {...p}>
    <path d="M7 17 17 7M8 7h9v9" />
  </Base>
);

export const IconDirections = (p: P) => (
  <Base {...p}>
    <path d="M12 2.8 21.2 12 12 21.2 2.8 12z" />
    <path d="M9.5 14v-2.5a1 1 0 0 1 1-1h4M12.8 8.5l2 2-2 2" />
  </Base>
);

export const IconMenu = (p: P) => (
  <Base {...p}>
    <path d="M4 7h16M4 12h16M4 17h10" />
  </Base>
);

export const IconClose = (p: P) => (
  <Base {...p}>
    <path d="M6 6l12 12M18 6 6 18" />
  </Base>
);

export const IconCheck = (p: P) => (
  <Base {...p}>
    <path d="m5 12.5 4.5 4.5L19 7.5" />
  </Base>
);

export const IconAlert = (p: P) => (
  <Base {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 7.8v5M12 16.2v.1" />
  </Base>
);

export const IconSpinner = (p: P) => (
  <Base {...p} className={`animate-spin ${p.className ?? ""}`}>
    <path d="M12 3.5a8.5 8.5 0 1 1-8.5 8.5" />
  </Base>
);

/* Serviços */
export const IconBag = (p: P) => (
  <Base {...p}>
    <path d="M5 8h14l-1 12.5H6z" />
    <path d="M9 10V6.5a3 3 0 0 1 6 0V10" />
  </Base>
);

export const IconScooter = (p: P) => (
  <Base {...p}>
    <circle cx="6" cy="17.5" r="2.5" />
    <circle cx="18" cy="17.5" r="2.5" />
    <path d="M8.5 17.5h6l2-6.5h-3M16.5 11 15 5.5h-2.5" />
    <path d="M3.5 13.5h6l1.5 4" />
  </Base>
);

export const IconTable = (p: P) => (
  <Base {...p}>
    <path d="M3.5 9.5h17M6 9.5 5 20M18 9.5l1 10.5M12 9.5V20" />
    <path d="M8 6.5h8" />
  </Base>
);

export const IconCloche = (p: P) => (
  <Base {...p}>
    <path d="M3 17.5h18M4.5 17.5a7.5 7.5 0 0 1 15 0" />
    <path d="M12 10V7.5M10.5 7h3" />
  </Base>
);

/* Pagamentos */
export const IconCash = (p: P) => (
  <Base {...p}>
    <rect x="2.8" y="6.5" width="18.4" height="11" rx="1.6" />
    <circle cx="12" cy="12" r="2.4" />
    <path d="M6 9.5v.01M18 14.5v.01" />
  </Base>
);

export const IconCard = (p: P) => (
  <Base {...p}>
    <rect x="2.8" y="5.5" width="18.4" height="13" rx="2" />
    <path d="M2.8 9.8h18.4M6.5 14.8h4" />
  </Base>
);

export const IconMobilePay = (p: P) => (
  <Base {...p}>
    <rect x="6.5" y="2.8" width="11" height="18.4" rx="2.2" />
    <path d="m9.5 11.5 2 2 3.5-3.8M11 18h2" />
  </Base>
);

export const IconContactless = (p: P) => (
  <Base {...p}>
    <path d="M8 8.5a5 5 0 0 1 0 7M11.3 6a8.5 8.5 0 0 1 0 12M14.6 3.6a12 12 0 0 1 0 16.8" />
  </Base>
);

/* Comodidades */
export const IconWheelchair = (p: P) => (
  <Base {...p}>
    <circle cx="10" cy="4.5" r="1.6" />
    <path d="M10 7.5v6h5.5l2.5 5.5" />
    <path d="M10 10.5h5" />
    <path d="M7.2 11a5 5 0 1 0 7 6.2" />
  </Base>
);

export const IconParking = (p: P) => (
  <Base {...p}>
    <rect x="3.5" y="3.5" width="17" height="17" rx="3" />
    <path d="M9.5 16.5v-9h3.2a2.8 2.8 0 0 1 0 5.6H9.5" />
  </Base>
);

export const IconWifi = (p: P) => (
  <Base {...p}>
    <path d="M2.8 9.2a13 13 0 0 1 18.4 0M5.9 12.5a8.6 8.6 0 0 1 12.2 0M9 15.7a4.2 4.2 0 0 1 6 0" />
    <path d="M12 19v.01" />
  </Base>
);

export const IconSnow = (p: P) => (
  <Base {...p}>
    <path d="M12 2.8v18.4M4 7.4l16 9.2M4 16.6l16-9.2" />
    <path d="m9.5 4.3 2.5 2 2.5-2M9.5 19.7l2.5-2 2.5 2" />
  </Base>
);

export const IconFamily = (p: P) => (
  <Base {...p}>
    <circle cx="8" cy="5.5" r="2" />
    <circle cx="16.5" cy="9.5" r="1.6" />
    <path d="M5.5 21v-7.5L4.5 10a2 2 0 0 1 2-2.3h3a2 2 0 0 1 2 2.3l-1 3.5V21M8 15v6" />
    <path d="M14.8 21v-4.5l-.8-2.5a1.4 1.4 0 0 1 1.4-1.8h2.2a1.4 1.4 0 0 1 1.4 1.8l-.8 2.5V21" />
  </Base>
);

export const IconGroup = (p: P) => (
  <Base {...p}>
    <circle cx="12" cy="7.5" r="2.8" />
    <path d="M6.5 19.5a5.5 5.5 0 0 1 11 0" />
    <circle cx="4.8" cy="9.5" r="1.9" />
    <circle cx="19.2" cy="9.5" r="1.9" />
    <path d="M2 17.5a3.6 3.6 0 0 1 3.8-3.4M22 17.5a3.6 3.6 0 0 0-3.8-3.4" />
  </Base>
);

export const IconDog = (p: P) => (
  <Base {...p}>
    <path d="M8 5 5 4l-1.5 5 3 1" />
    <path d="M16 5l3-1 1.5 5-3 1" />
    <path d="M6.5 9.5V14a5.5 5.5 0 0 0 11 0V9.5A4.5 4.5 0 0 0 13 5h-2a4.5 4.5 0 0 0-4.5 4.5z" />
    <path d="M10 11v.01M14 11v.01M10.5 15.5 12 16.5l1.5-1" />
  </Base>
);

/* Redes sociais (contorno, coerentes com o resto do conjunto) */
export const IconFacebook = (p: P) => (
  <Base {...p}>
    <rect x="3" y="3" width="18" height="18" rx="5" />
    <path d="M15.5 8h-1.8a2 2 0 0 0-2 2v11M9.5 13h5" />
  </Base>
);

export const IconInstagram = (p: P) => (
  <Base {...p}>
    <rect x="3" y="3" width="18" height="18" rx="5" />
    <circle cx="12" cy="12" r="4" />
    <path d="M17.3 6.7v.01" />
  </Base>
);
