"use client";

export default function KobaraLoader() {
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-[#020B14]">
      <div className="relative flex items-center justify-center">
        {/* Spinner ring */}
        <div className="kobara-loader-ring" />
        {/* Logo at center */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/Icone.png"
          alt="Kobara"
          className="absolute w-8 h-8 object-contain"
          draggable={false}
        />
      </div>

      <style jsx>{`
        .kobara-loader-ring {
          width: 60px;
          aspect-ratio: 1;
          border-radius: 50%;
          border: 5px solid #1E2A38;
          border-right-color: #FF4A1C;
          animation: kobara-spin 0.8s infinite linear;
        }
        @keyframes kobara-spin {
          to {
            transform: rotate(1turn);
          }
        }
      `}</style>
    </div>
  );
}
