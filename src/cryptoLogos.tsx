import React from "react";

export function CryptoLogo({ symbol, size = 28 }: { symbol: string; size?: number }) {
  const base = symbol.split("/")[0].toUpperCase();

  switch (base) {
    case "BTC":
      return (
        <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
          <circle cx="16" cy="16" r="16" fill="#F7931A" />
          <path
            d="M23.189 14.02c.314-2.096-.856-3.223-2.311-3.974l.472-1.89-1.15-.287-.46 1.84c-.302-.075-.613-.146-.924-.217l.464-1.859-1.15-.287-.472 1.891c-.25-.057-.497-.113-.733-.173l.001-.006-1.587-.396-.306 1.23s.854.196.836.208c.466.116.55.424.536.668l-.537 2.155c.032.008.074.02.12.04-.038-.01-.079-.02-.12-.032l-.753 3.018c-.057.142-.202.355-.529.274.012.016-.837-.209-.837-.209l-.572 1.319 1.498.373c.279.07.551.143.818.212l-.478 1.921 1.15.287.472-1.894c.314.085.619.164.918.239l-.47 1.884 1.15.287.477-1.914c1.963.372 3.438.222 4.059-1.554.501-1.43-.025-2.255-1.059-2.793.753-.174 1.32-.67 1.472-1.696zm-2.632 3.695c-.356 1.428-2.76.656-3.54.462l.632-2.532c.78.195 3.28.581 2.908 2.07zm.356-3.712c-.324 1.3-2.327.64-2.977.478l.573-2.296c.65.162 2.741.464 2.404 1.818z"
            fill="#FFF"
          />
        </svg>
      );

    case "ETH":
      return (
        <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
          <circle cx="16" cy="16" r="16" fill="#627EEA" />
          <path
            d="M16.498 4v8.87l7.497 3.35L16.498 4z"
            fill="#FFF"
            fillOpacity=".6"
          />
          <path d="M16.498 4L9 16.22l7.498-3.35V4z" fill="#FFF" />
          <path
            d="M16.498 21.968v6.027L24 17.616l-7.502 4.352z"
            fill="#FFF"
            fillOpacity=".6"
          />
          <path d="M16.498 27.995v-6.027L9 17.616l7.498 10.38z" fill="#FFF" />
          <path
            d="M16.498 20.573l7.497-4.353-7.497-3.348v7.701z"
            fill="#FFF"
            fillOpacity=".2"
          />
          <path
            d="M9 16.22l7.498 4.353v-7.701L9 16.22z"
            fill="#FFF"
            fillOpacity=".6"
          />
        </svg>
      );

    case "SOL":
      return (
        <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
          <circle cx="16" cy="16" r="16" fill="#000" />
          <defs>
            <linearGradient id="solGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#00FFA3" />
              <stop offset="100%" stopColor="#DC1FFF" />
            </linearGradient>
          </defs>
          <path
            d="M8.2 21.7c.1-.1.3-.2.5-.2h14.7c.3 0 .5.3.3.5l-2.4 2.4c-.1.1-.3.2-.5.2H6.1c-.3 0-.5-.3-.3-.5l2.4-2.4zm0-11.4c.1-.1.3-.2.5-.2h14.7c.3 0 .5.3.3.5l-2.4 2.4c-.1.1-.3.2-.5.2H6.1c-.3 0-.5-.3-.3-.5l2.4-2.4zm15.6 5.7c-.1-.1-.3-.2-.5-.2H8.6c-.3 0-.5.3-.3.5l2.4 2.4c.1.1.3.2.5.2h14.7c.3 0 .5-.3.3-.5l-2.4-2.4z"
            fill="url(#solGrad)"
          />
        </svg>
      );

    case "BNB":
      return (
        <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
          <circle cx="16" cy="16" r="16" fill="#F3BA2F" />
          <path
            d="M16 6.5l3.2 3.2-5.5 5.5-3.2-3.2L16 6.5zm5.9 5.9l3.2 3.2-3.2 3.2-3.2-3.2 3.2-3.2zM6.9 15.6l3.2-3.2 3.2 3.2-3.2 3.2-3.2-3.2zm6.8 2.3l2.3-2.3 2.3 2.3-2.3 2.3-2.3-2.3zm2.3 3.5l5.5-5.5 3.2 3.2L16 25.5l-8.7-8.7 3.2-3.2 5.5 5.5z"
            fill="#FFF"
          />
        </svg>
      );

    case "XRP":
      return (
        <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
          <circle cx="16" cy="16" r="16" fill="#23292F" />
          <path
            d="M23.3 9h2.3l-5.6 5.5 3.9 3.9c.7.7.7 1.8 0 2.5l-3.9 3.9H17.7l3.9-3.9c.7-.7.7-1.8 0-2.5L16 12.8 10.4 18.4c-.7.7-.7 1.8 0 2.5l3.9 3.9H12l-3.9-3.9c-.7-.7-.7-1.8 0-2.5l3.9-3.9L6.4 9h2.3l5.6 5.5 3.9-3.9c.7-.7 1.8-.7 2.5 0L23.3 9z"
            fill="#FFF"
          />
        </svg>
      );

    case "DOGE":
      return (
        <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
          <circle cx="16" cy="16" r="16" fill="#C2A633" />
          <path
            d="M11 8h5.8c4.2 0 7.2 2.8 7.2 8s-3 8-7.2 8H11V8zm3.6 12.8h2.1c2.3 0 3.8-1.7 3.8-4.8 0-3-1.5-4.8-3.8-4.8h-2.1v9.6z"
            fill="#FFF"
          />
          <path d="M9 15h9v2H9z" fill="#FFF" />
        </svg>
      );

    case "ADA":
      return (
        <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
          <circle cx="16" cy="16" r="16" fill="#0033AD" />
          <circle cx="16" cy="16" r="3.2" fill="#FFF" />
          <circle cx="16" cy="8.5" r="1.6" fill="#FFF" />
          <circle cx="16" cy="23.5" r="1.6" fill="#FFF" />
          <circle cx="8.5" cy="16" r="1.6" fill="#FFF" />
          <circle cx="23.5" cy="16" r="1.6" fill="#FFF" />
          <circle cx="10.8" cy="10.8" r="1.3" fill="#FFF" opacity="0.8" />
          <circle cx="21.2" cy="21.2" r="1.3" fill="#FFF" opacity="0.8" />
          <circle cx="10.8" cy="21.2" r="1.3" fill="#FFF" opacity="0.8" />
          <circle cx="21.2" cy="10.8" r="1.3" fill="#FFF" opacity="0.8" />
        </svg>
      );

    case "AVAX":
      return (
        <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
          <circle cx="16" cy="16" r="16" fill="#E84142" />
          <path
            d="M19.9 8.5c-.6-1-2-1-2.6 0l-9.8 17c-.6 1 .1 2.3 1.3 2.3h4.8c.8 0 1.5-.4 1.9-1.1l3.1-5.5c.6-1 2-1 2.6 0l3.1 5.5c.4.7 1.1 1.1 1.9 1.1h1.4c1.2 0 1.9-1.3 1.3-2.3l-9-17zm-3.9 9.8l-1.9 3.3h3.8l-1.9-3.3z"
            fill="#FFF"
          />
        </svg>
      );

    case "SUI":
      return (
        <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
          <circle cx="16" cy="16" r="16" fill="#4DA2FF" />
          <path
            d="M16 6c-3.5 4.5-8 10.5-8 14.5a8 8 0 1016 0C24 16.5 19.5 10.5 16 6z"
            fill="#FFF"
          />
        </svg>
      );

    case "NEAR":
      return (
        <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
          <circle cx="16" cy="16" r="16" fill="#000" />
          <path
            d="M10 22V10l12 12V10"
            stroke="#FFF"
            strokeWidth="3.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );

    case "LINK":
      return (
        <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
          <circle cx="16" cy="16" r="16" fill="#375BD2" />
          <path
            d="M16 6l7 4v12l-7 4-7-4V10l7-4zm4 6l-4-2.3-4 2.3v4.6l4 2.3 4-2.3V12z"
            fill="#FFF"
          />
        </svg>
      );

    case "PEPE":
      return (
        <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
          <circle cx="16" cy="16" r="16" fill="#4B8C36" />
          <circle cx="12" cy="14" r="3.5" fill="#FFF" />
          <circle cx="20" cy="14" r="3.5" fill="#FFF" />
          <circle cx="12" cy="14" r="1.5" fill="#000" />
          <circle cx="20" cy="14" r="1.5" fill="#000" />
          <path d="M10 22c3 2 9 2 12 0" stroke="#000" strokeWidth="2" strokeLinecap="round" />
        </svg>
      );

    case "SHIB":
      return (
        <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
          <circle cx="16" cy="16" r="16" fill="#FFA409" />
          <path
            d="M8 12l4 8 4-4 4 4 4-8-4 1-4-3-4 3-4-1z"
            fill="#FFF"
          />
        </svg>
      );

    case "LTC":
      return (
        <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
          <circle cx="16" cy="16" r="16" fill="#345D9D" />
          <path
            d="M13 8h3v11h6v3H13V8zm-2 7l8-3v2l-8 3v-2z"
            fill="#FFF"
          />
        </svg>
      );

    case "DOT":
      return (
        <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
          <circle cx="16" cy="16" r="16" fill="#E6007A" />
          <circle cx="16" cy="11" r="3" fill="#FFF" />
          <circle cx="16" cy="21" r="3" fill="#FFF" />
        </svg>
      );

    case "TRX":
      return (
        <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
          <circle cx="16" cy="16" r="16" fill="#EF0027" />
          <path
            d="M8 8l16 5-8 11L8 8zm4 3l8 2.5-4 5.5-4-8z"
            fill="#FFF"
          />
        </svg>
      );

    default:
      return (
        <div
          style={{ width: size, height: size }}
          className="rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-bold"
        >
          {base.slice(0, 3)}
        </div>
      );
  }
}
