"use client";

import { useEffect, useRef } from "react";
import JsBarcode from "jsbarcode";

// Renders a scannable Code128 barcode for a bin code. Code128 is readable by
// both phone cameras (@zxing) and HID laser/CCD scanners. `width` is the bar
// width and `height` the bar height — bump them for a big, wall-mount label.
export function Barcode({
  value,
  width = 2,
  height = 60,
}: {
  value: string;
  width?: number;
  height?: number;
}) {
  const ref = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    try {
      JsBarcode(ref.current, value, {
        format: "CODE128",
        displayValue: true,
        width,
        height,
        margin: 8,
        fontSize: 14,
      });
    } catch {
      // Ignore invalid values; nothing to render.
    }
  }, [value, width, height]);

  return <svg ref={ref} className="max-w-full" />;
}
