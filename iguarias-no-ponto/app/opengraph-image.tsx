import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

export const alt = "Iguarias no Ponto — comida caseira portuguesa e take-away em Coimbra";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OgImage() {
  const photo = await readFile(join(process.cwd(), "public/images/IMG_2662.jpeg"));
  const src = `data:image/jpeg;base64,${photo.toString("base64")}`;
  return new ImageResponse(
    (
      <div style={{ display: "flex", width: "100%", height: "100%", background: "#1f1813" }}>
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", width: 660, padding: "0 64px", color: "#f6efe3" }}>
          <div style={{ fontSize: 26, letterSpacing: 4, color: "#b9d531", textTransform: "uppercase" }}>Coimbra · Santo António dos Olivais</div>
          <div style={{ fontSize: 104, lineHeight: 1, marginTop: 24, fontWeight: 600 }}>Iguarias</div>
          <div style={{ fontSize: 76, lineHeight: 1.05, color: "#b9d531", fontStyle: "italic" }}>no ponto.</div>
          <div style={{ fontSize: 32, marginTop: 32, color: "#e6dccb" }}>Comida caseira portuguesa, take-away, entregas e catering.</div>
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt="" width={540} height={630} style={{ objectFit: "cover", objectPosition: "50% 62%" }} />
      </div>
    ),
    size,
  );
}
