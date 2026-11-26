import { useEffect, useState } from 'react';

/**
 * The redeem code as a QR Code for the staff scanner. The encoder loads only when a
 * code exists; dark modules are drawn as one path, black on white for any scanner.
 */
export function RedeemQr({ code }: { code: string }) {
  const [path, setPath] = useState<{ size: number; d: string } | null>(null);
  useEffect(() => {
    let live = true;
    import('uqr').then(({ encode }) => {
      const { size, data } = encode(code, { ecc: 'M', border: 4 });
      let d = '';
      data.forEach((row, y) => {
        row.forEach((dark, x) => {
          if (dark) d += `M${x} ${y}h1v1h-1z`;
        });
      });
      if (live) setPath({ size, d });
    });
    return () => {
      live = false;
    };
  }, [code]);
  if (!path) return null;
  return (
    <svg
      className="redeem-qr"
      viewBox={`0 0 ${path.size} ${path.size}`}
      shapeRendering="crispEdges"
      role="img"
      aria-label={`兌獎碼 ${code} 的 QR Code`}
    >
      <rect width={path.size} height={path.size} fill="#fff" />
      <path d={path.d} fill="#000" />
    </svg>
  );
}
