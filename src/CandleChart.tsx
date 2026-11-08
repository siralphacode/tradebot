import React, { useEffect, useRef, useState, useCallback } from "react";
import { ChartSignalMarker, TatsProData } from "./technicalAnalysis.ts";
import { PriceAlert } from "./priceAlerts.ts";
import { ZoomIn, ZoomOut, RotateCcw, Clock, Layers, Sliders, Eye } from "lucide-react";

export interface KlineData {
  openTime: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface CandleChartProps {
  klines: KlineData[];
  currentPrice: number;
  symbol: string;
  decimals?: number;
  interval?: string;
  signalMarkers?: ChartSignalMarker[];
  showSignals?: boolean;
  tatsData?: TatsProData;
  alerts?: PriceAlert[];
  isLoading?: boolean;
  onToggleSignals?: () => void;
  onRefresh?: () => void;
}

export const CandleChart: React.FC<CandleChartProps> = ({
  klines,
  currentPrice,
  symbol,
  decimals = 2,
  interval = "15m",
  signalMarkers = [],
  showSignals = true,
  tatsData,
  alerts = [],
  isLoading = false,
  onToggleSignals,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // TATS PRO Visual Settings (Matches Pine Script inputs)
  const [showCloud, setShowCloud] = useState<boolean>(true);
  const [showLevels, setShowLevels] = useState<boolean>(true);
  const [showEMAs, setShowEMAs] = useState<boolean>(false); // intermediate EMAs 35, 40, 45, 50

  // Zoom and Pan state
  const [visibleCount, setVisibleCount] = useState<number>(45);
  const [panOffset, setPanOffset] = useState<number>(0);

  // Dragging state for horizontal pan
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<{ clientX: number; initialOffset: number }>({ clientX: 0, initialOffset: 0 });

  // Hover state for crosshair & tooltip
  const [hoveredCandleIndex, setHoveredCandleIndex] = useState<number | null>(null);
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null);

  // Reset zoom when symbol or interval changes
  useEffect(() => {
    setVisibleCount(Math.min(Math.max(klines.length, 10), 45));
    setPanOffset(0);
  }, [symbol, interval]);

  const formatPrice = useCallback(
    (val: number) => {
      return Number(val || 0).toLocaleString(undefined, {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      });
    },
    [decimals]
  );

  const formatTime = useCallback((timestamp: number, tf: string) => {
    const d = new Date(timestamp);
    if (tf === "1d") {
      const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      return `${months[d.getMonth()]} ${d.getDate()}`;
    }
    const h = String(d.getHours()).padStart(2, "0");
    const m = String(d.getMinutes()).padStart(2, "0");
    const s = String(d.getSeconds()).padStart(2, "0");
    if (tf === "15m" || tf === "1h" || tf === "4h") {
      return `${h}:${m}`;
    }
    return `${h}:${m}:${s}`;
  }, []);

  // Zoom handlers
  const handleZoomIn = () => {
    setVisibleCount((prev) => Math.max(12, Math.floor(prev * 0.75)));
  };

  const handleZoomOut = () => {
    setVisibleCount((prev) => Math.min(klines.length, Math.ceil(prev * 1.35)));
  };

  const handleResetZoom = () => {
    setVisibleCount(Math.min(Math.max(klines.length, 10), 45));
    setPanOffset(0);
  };

  // Wheel zoom handler
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (klines.length === 0) return;

      if (e.deltaY < 0) {
        setVisibleCount((prev) => Math.max(12, Math.floor(prev * 0.85)));
      } else {
        setVisibleCount((prev) => Math.min(klines.length, Math.ceil(prev * 1.18)));
      }
    };

    container.addEventListener("wheel", handleWheel, { passive: false });
    return () => {
      container.removeEventListener("wheel", handleWheel);
    };
  }, [klines.length]);

  // Re-render when container resizes
  const [containerDimensions, setContainerDimensions] = useState<{ width: number; height: number }>({
    width: 0,
    height: 0,
  });

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerDimensions({
          width: entry.contentRect.width,
          height: entry.contentRect.height,
        });
      }
    });

    ro.observe(container);
    return () => ro.disconnect();
  }, []);

  // Main canvas render effect
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const width = container.clientWidth;
    const height = container.clientHeight;
    const dpr = window.devicePixelRatio || 1;

    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    ctx.scale(dpr, dpr);

    // Padding for axes
    const paddingRight = 100; // price axis + TATS TP/SL labels
    const paddingBottom = 28; // time axis
    const paddingTop = 28;
    const paddingLeft = 12;

    const chartWidth = width - paddingRight - paddingLeft;
    const chartHeight = height - paddingBottom - paddingTop;
    const volumeHeight = chartHeight * 0.14;
    const priceChartHeight = chartHeight - volumeHeight - 14;

    // Clear background
    ctx.fillStyle = "#080a10";
    ctx.fillRect(0, 0, width, height);

    if (klines.length === 0) {
      ctx.fillStyle = "#64748b";
      ctx.font = "14px Inter, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("Loading TATS PRO chart data...", width / 2, height / 2);
      return;
    }

    // Calculate visible window based on zoom & pan
    const totalCount = klines.length;
    const clampedVisible = Math.min(totalCount, Math.max(12, visibleCount));
    const maxOffset = Math.max(0, totalCount - clampedVisible);
    const clampedOffset = Math.min(maxOffset, Math.max(0, panOffset));

    const endIndex = totalCount - clampedOffset;
    const startIndex = Math.max(0, endIndex - clampedVisible);
    const visibleKlines = klines.slice(startIndex, endIndex);
    const count = visibleKlines.length;

    if (count === 0) return;

    // Determine min/max price for the visible window
    let minPrice = Infinity;
    let maxPrice = -Infinity;
    let maxVolume = 0;

    for (let i = 0; i < count; i++) {
      const k = visibleKlines[i];
      if (k.low < minPrice) minPrice = k.low;
      if (k.high > maxPrice) maxPrice = k.high;
      if (k.volume > maxVolume) maxVolume = k.volume;

      // Include EMA values in bounds so cloud is never clipped
      if (tatsData && showCloud) {
        const gIdx = startIndex + i;
        const e1 = tatsData.emaFastSeries[gIdx];
        const e6 = tatsData.emaSlowSeries[gIdx];
        if (e1 && e1 < minPrice) minPrice = e1;
        if (e1 && e1 > maxPrice) maxPrice = e1;
        if (e6 && e6 < minPrice) minPrice = e6;
        if (e6 && e6 > maxPrice) maxPrice = e6;
      }
    }

    if (currentPrice > 0 && clampedOffset === 0) {
      if (currentPrice < minPrice) minPrice = currentPrice;
      if (currentPrice > maxPrice) maxPrice = currentPrice;
    }

    // Guarantee that ALL 7 TATS PRO targets, ENTRY, and STOP LOSS fit cleanly on the chart
    if (showLevels && tatsData && tatsData.levels && tatsData.levels.length > 0) {
      tatsData.levels.forEach((lvl) => {
        if (lvl.price > 0) {
          if (lvl.price < minPrice) minPrice = lvl.price;
          if (lvl.price > maxPrice) maxPrice = lvl.price;
        }
      });
    }

    // Add breathing room
    const priceRange = maxPrice - minPrice || 1;
    minPrice -= priceRange * 0.08;
    maxPrice += priceRange * 0.08;
    const adjustedRange = maxPrice - minPrice;

    const getY = (price: number) => {
      return paddingTop + priceChartHeight - ((price - minPrice) / adjustedRange) * priceChartHeight;
    };

    const candleSlotWidth = chartWidth / count;
    const candleBodyWidth = Math.max(2, candleSlotWidth * 0.72);

    // 1. Draw horizontal grid lines and Price Axis
    ctx.lineWidth = 1;
    ctx.strokeStyle = "#141a26";
    ctx.fillStyle = "#94a3b8";
    ctx.font = "bold 12px Inter, sans-serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";

    const gridSteps = 7;
    for (let i = 0; i <= gridSteps; i++) {
      const p = minPrice + (adjustedRange / gridSteps) * i;
      const y = getY(p);

      ctx.beginPath();
      ctx.moveTo(paddingLeft, y);
      ctx.lineTo(width - paddingRight, y);
      ctx.stroke();

      ctx.fillText(formatPrice(p), width - paddingRight + 8, y);
    }

    // Right axis line
    ctx.beginPath();
    ctx.strokeStyle = "#1e293b";
    ctx.moveTo(width - paddingRight, paddingTop);
    ctx.lineTo(width - paddingRight, height - paddingBottom);
    ctx.stroke();

    // Bottom axis line
    ctx.beginPath();
    ctx.moveTo(paddingLeft, height - paddingBottom);
    ctx.lineTo(width - paddingRight, height - paddingBottom);
    ctx.stroke();

    // 2. Draw TATS PRO 6-EMA Cloud (Between EMA 30 and EMA 60)
    if (showCloud && tatsData && tatsData.emaFastSeries && tatsData.emaSlowSeries) {
      const fastPts: { x: number; y: number }[] = [];
      const slowPts: { x: number; y: number }[] = [];

      for (let i = 0; i < count; i++) {
        const gIdx = startIndex + i;
        const eFast = tatsData.emaFastSeries[gIdx];
        const eSlow = tatsData.emaSlowSeries[gIdx];
        const centerX = paddingLeft + i * candleSlotWidth + candleSlotWidth / 2;

        if (eFast && eSlow) {
          fastPts.push({ x: centerX, y: getY(eFast) });
          slowPts.push({ x: centerX, y: getY(eSlow) });
        }
      }

      if (fastPts.length > 1) {
        // A. Fill Cloud Area
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(fastPts[0].x, fastPts[0].y);
        for (let i = 1; i < fastPts.length; i++) {
          ctx.lineTo(fastPts[i].x, fastPts[i].y);
        }
        for (let i = slowPts.length - 1; i >= 0; i--) {
          ctx.lineTo(slowPts[i].x, slowPts[i].y);
        }
        ctx.closePath();

        // Shading depends on latest alignment
        const cloudFill = tatsData.bullAligned
          ? "rgba(14, 203, 129, 0.16)"
          : tatsData.bearAligned
          ? "rgba(246, 70, 93, 0.16)"
          : "rgba(148, 163, 184, 0.08)";
        ctx.fillStyle = cloudFill;
        ctx.fill();
        ctx.restore();

        // B. Draw Intermediate EMAs (if enabled)
        if (showEMAs) {
          const drawEmaLine = (series: number[], color: string) => {
            ctx.save();
            ctx.strokeStyle = color;
            ctx.lineWidth = 1;
            ctx.beginPath();
            let started = false;
            for (let i = 0; i < count; i++) {
              const val = series[startIndex + i];
              if (!val) continue;
              const x = paddingLeft + i * candleSlotWidth + candleSlotWidth / 2;
              const y = getY(val);
              if (!started) {
                ctx.moveTo(x, y);
                started = true;
              } else {
                ctx.lineTo(x, y);
              }
            }
            ctx.stroke();
            ctx.restore();
          };

          drawEmaLine(tatsData.ema2Series, "rgba(20, 184, 166, 0.7)"); // EMA 35 teal
          drawEmaLine(tatsData.ema3Series, "rgba(34, 197, 94, 0.7)");  // EMA 40 green
          drawEmaLine(tatsData.ema4Series, "rgba(234, 179, 8, 0.7)");  // EMA 45 yellow
          drawEmaLine(tatsData.ema5Series, "rgba(168, 85, 247, 0.7)"); // EMA 50 purple
        }

        // C. Draw EMA Fast (30) in Cyan/Aqua
        ctx.save();
        ctx.strokeStyle = "#00e5ff"; // Aqua
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.moveTo(fastPts[0].x, fastPts[0].y);
        for (let i = 1; i < fastPts.length; i++) {
          ctx.lineTo(fastPts[i].x, fastPts[i].y);
        }
        ctx.stroke();
        ctx.restore();

        // D. Draw EMA Slow (60) in Orange
        ctx.save();
        ctx.strokeStyle = "#ff9800"; // Orange
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.moveTo(slowPts[0].x, slowPts[0].y);
        for (let i = 1; i < slowPts.length; i++) {
          ctx.lineTo(slowPts[i].x, slowPts[i].y);
        }
        ctx.stroke();
        ctx.restore();
      }
    }

    // 3. Draw Candlesticks & Volume
    visibleKlines.forEach((candle, idx) => {
      const centerX = paddingLeft + idx * candleSlotWidth + candleSlotWidth / 2;
      const isBullish = candle.close >= candle.open;
      const candleColor = isBullish ? "#0ecb81" : "#f6465d";

      // Volume bar
      const vRatio = maxVolume > 0 ? candle.volume / maxVolume : 0.1;
      const vBarHeight = vRatio * volumeHeight;
      const vTop = paddingTop + chartHeight - vBarHeight;

      ctx.fillStyle = isBullish ? "rgba(14, 203, 129, 0.22)" : "rgba(246, 70, 93, 0.22)";
      ctx.fillRect(centerX - candleBodyWidth / 2, vTop, candleBodyWidth, vBarHeight);

      // Wick
      const highY = getY(candle.high);
      const lowY = getY(candle.low);

      ctx.strokeStyle = candleColor;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(centerX, highY);
      ctx.lineTo(centerX, lowY);
      ctx.stroke();

      // Body
      const openY = getY(candle.open);
      const closeY = getY(candle.close);
      const bodyTop = Math.min(openY, closeY);
      const bodyHeight = Math.max(1.5, Math.abs(openY - closeY));

      ctx.fillStyle = candleColor;
      ctx.fillRect(centerX - candleBodyWidth / 2, bodyTop, candleBodyWidth, bodyHeight);
    });

    // 4. Draw TATS BUY / SELL Signal Markers on Candles
    if (showSignals && signalMarkers && signalMarkers.length > 0) {
      signalMarkers.forEach((sig) => {
        const globalIdx = sig.index;
        if (globalIdx < startIndex || globalIdx >= endIndex) return;

        const visibleIdx = globalIdx - startIndex;
        const candle = visibleKlines[visibleIdx];
        if (!candle) return;

        const centerX = paddingLeft + visibleIdx * candleSlotWidth + candleSlotWidth / 2;
        const isUp = sig.type === "UP";

        if (isUp) {
          // BUY Signal (Green ▲ Below Candle)
          const lowY = getY(candle.low);
          const arrowTipY = lowY + 6;
          const arrowBaseY = arrowTipY + 9;

          ctx.fillStyle = "#00e676";
          ctx.beginPath();
          ctx.moveTo(centerX, arrowTipY);
          ctx.lineTo(centerX - 5, arrowBaseY);
          ctx.lineTo(centerX + 5, arrowBaseY);
          ctx.closePath();
          ctx.fill();

          // Badge Bubble
          const badgeY = arrowBaseY + 4;
          const badgeText = `${sig.label} ${sig.confidence}%`;
          ctx.font = "bold 12px Inter, sans-serif";
          const textWidth = ctx.measureText(badgeText).width;
          const badgeW = textWidth + 10;
          const badgeH = 19;

          ctx.fillStyle = "rgba(0, 200, 83, 0.95)";
          ctx.beginPath();
          ctx.roundRect(centerX - badgeW / 2, badgeY, badgeW, badgeH, 4);
          ctx.fill();

          ctx.fillStyle = "#000000";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(badgeText, centerX, badgeY + badgeH / 2);
        } else {
          // SELL Signal (Red ▼ Above Candle)
          const highY = getY(candle.high);
          const arrowTipY = highY - 7;
          const arrowBaseY = arrowTipY - 10;

          ctx.fillStyle = "#ff1744";
          ctx.beginPath();
          ctx.moveTo(centerX, arrowTipY);
          ctx.lineTo(centerX - 6, arrowBaseY);
          ctx.lineTo(centerX + 6, arrowBaseY);
          ctx.closePath();
          ctx.fill();

          // Badge Bubble
          const badgeY = arrowBaseY - 22;
          const badgeText = `${sig.label} ${sig.confidence}%`;
          ctx.font = "bold 12px Inter, sans-serif";
          const textWidth = ctx.measureText(badgeText).width;
          const badgeW = textWidth + 10;
          const badgeH = 19;

          ctx.fillStyle = "rgba(244, 67, 54, 0.95)";
          ctx.beginPath();
          ctx.roundRect(centerX - badgeW / 2, badgeY, badgeW, badgeH, 4);
          ctx.fill();

          ctx.fillStyle = "#ffffff";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(badgeText, centerX, badgeY + badgeH / 2);
        }
      });
    }

    // 5. Draw TATS PRO Last Confirmed Signal Risk Levels (ENTRY, SL, TP1-TP7)
    if (showLevels && tatsData && tatsData.levels && tatsData.levels.length > 0) {
      // Span full chart width from left padding to right price axis
      const startX = paddingLeft;
      const endX = width - paddingRight;
      const entryPx = tatsData.entryPrice || currentPrice;

      tatsData.levels.forEach((lvl) => {
        const y = getY(lvl.price);
        if (y < paddingTop - 12 || y > height - paddingBottom + 12) return;

        // Calculate distance percentage from entry
        const distPct =
          entryPx > 0
            ? Math.abs(((lvl.price - entryPx) / entryPx) * 100).toFixed(2)
            : "0.00";

        ctx.save();
        if (lvl.type === "ENTRY") {
          // Entry Line: Solid Silver-White (lineWidth=2.2)
          ctx.strokeStyle = "#e2e8f0";
          ctx.lineWidth = 2.2;
          ctx.beginPath();
          ctx.moveTo(startX, y);
          ctx.lineTo(endX, y);
          ctx.stroke();

          // In-Chart Label on Line (Left side)
          const tagText = `▶ ENTRY: $${formatPrice(lvl.price)}`;
          ctx.font = "bold 11px Inter, monospace";
          const tagWidth = ctx.measureText(tagText).width + 12;
          const tagX = startX + 16;

          ctx.fillStyle = "rgba(15, 23, 42, 0.92)";
          ctx.strokeStyle = "#94a3b8";
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.roundRect(tagX, y - 10, tagWidth, 20, 4);
          ctx.fill();
          ctx.stroke();

          ctx.fillStyle = "#ffffff";
          ctx.textAlign = "left";
          ctx.textBaseline = "middle";
          ctx.fillText(tagText, tagX + 6, y);

          // Right Price Axis Badge
          const badgeH = 20;
          const badgeW = paddingRight - 6;
          const badgeX = endX + 3;
          const badgeY = y - badgeH / 2;

          ctx.fillStyle = "#334155";
          ctx.strokeStyle = "#94a3b8";
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.roundRect(badgeX, badgeY, badgeW, badgeH, 4);
          ctx.fill();
          ctx.stroke();

          ctx.fillStyle = "#ffffff";
          ctx.font = "bold 10px Inter, monospace";
          ctx.textAlign = "left";
          ctx.textBaseline = "middle";
          ctx.fillText(`ENTRY ${formatPrice(lvl.price)}`, badgeX + 4, y);
        } else if (lvl.type === "STOP_LOSS") {
          // SL Line: Vibrant Red Dashed (lineWidth=2.2)
          ctx.strokeStyle = "#ef4444";
          ctx.lineWidth = 2.2;
          ctx.setLineDash([7, 4]);
          ctx.beginPath();
          ctx.moveTo(startX, y);
          ctx.lineTo(endX, y);
          ctx.stroke();

          // In-Chart Label on Line
          const tagText = `STOP LOSS [SL]: $${formatPrice(lvl.price)} (-${distPct}%)`;
          ctx.font = "bold 11px Inter, monospace";
          const tagWidth = ctx.measureText(tagText).width + 12;
          const tagX = startX + 16;

          ctx.fillStyle = "rgba(69, 10, 10, 0.94)";
          ctx.strokeStyle = "#ef4444";
          ctx.lineWidth = 1;
          ctx.setLineDash([]);
          ctx.beginPath();
          ctx.roundRect(tagX, y - 10, tagWidth, 20, 4);
          ctx.fill();
          ctx.stroke();

          ctx.fillStyle = "#fca5a5";
          ctx.textAlign = "left";
          ctx.textBaseline = "middle";
          ctx.fillText(tagText, tagX + 6, y);

          // Right Price Axis Badge
          const badgeH = 20;
          const badgeW = paddingRight - 6;
          const badgeX = endX + 3;
          const badgeY = y - badgeH / 2;

          ctx.fillStyle = "#b91c1c";
          ctx.beginPath();
          ctx.roundRect(badgeX, badgeY, badgeW, badgeH, 4);
          ctx.fill();

          ctx.fillStyle = "#ffffff";
          ctx.font = "bold 10px Inter, monospace";
          ctx.textAlign = "left";
          ctx.textBaseline = "middle";
          ctx.fillText(`SL ${formatPrice(lvl.price)}`, badgeX + 4, y);
        } else if (lvl.type === "TAKE_PROFIT") {
          // TP1 - TP7 Lines: Dotted Emerald Green (color varies slightly per target)
          const tpColors = [
            "#34d399", // TP1
            "#10b981", // TP2
            "#059669", // TP3
            "#22c55e", // TP4
            "#16a34a", // TP5
            "#84cc16", // TP6
            "#a3e635", // TP7
          ];
          const strokeColor = tpColors[(lvl.multiple - 1) % tpColors.length] || "#22c55e";

          ctx.strokeStyle = strokeColor;
          ctx.lineWidth = 1.8;
          ctx.setLineDash([4, 3]);
          ctx.beginPath();
          ctx.moveTo(startX, y);
          ctx.lineTo(endX, y);
          ctx.stroke();

          // In-Chart Label on Line (Staggered slightly across width so labels don't collide)
          const tagText = `${lvl.label} [${lvl.multiple}R]: $${formatPrice(lvl.price)} (+${distPct}%)`;
          ctx.font = "bold 10.5px Inter, monospace";
          const tagWidth = ctx.measureText(tagText).width + 12;
          const tagX = startX + 16 + ((lvl.multiple - 1) * 24);

          ctx.fillStyle = "rgba(6, 44, 25, 0.92)";
          ctx.strokeStyle = strokeColor;
          ctx.lineWidth = 1;
          ctx.setLineDash([]);
          ctx.beginPath();
          ctx.roundRect(tagX, y - 10, tagWidth, 20, 4);
          ctx.fill();
          ctx.stroke();

          ctx.fillStyle = "#4ade80";
          ctx.textAlign = "left";
          ctx.textBaseline = "middle";
          ctx.fillText(tagText, tagX + 6, y);

          // Right Price Axis Badge
          const badgeH = 18;
          const badgeW = paddingRight - 6;
          const badgeX = endX + 3;
          const badgeY = y - badgeH / 2;

          ctx.fillStyle = lvl.multiple <= 3 ? "rgba(16, 185, 129, 0.95)" : "rgba(34, 197, 94, 0.95)";
          ctx.beginPath();
          ctx.roundRect(badgeX, badgeY, badgeW, badgeH, 4);
          ctx.fill();

          ctx.fillStyle = "#000000";
          ctx.font = "black 10px Inter, monospace";
          ctx.textAlign = "left";
          ctx.textBaseline = "middle";
          ctx.fillText(`${lvl.label} ${formatPrice(lvl.price)}`, badgeX + 4, y);
        }
        ctx.restore();
      });
    }

    // 6. Draw Time Axis Labels
    ctx.fillStyle = "#94a3b8";
    ctx.font = "bold 11px Inter, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";

    const timeStep = Math.max(1, Math.floor(count / 6));
    for (let i = 0; i < count; i += timeStep) {
      const candle = visibleKlines[i];
      const centerX = paddingLeft + i * candleSlotWidth + candleSlotWidth / 2;
      ctx.fillText(formatTime(candle.openTime, interval), centerX, height - paddingBottom + 8);
    }

    // 7. Draw Current Price Dashed Line across the chart
    if (currentPrice > 0) {
      const currentY = getY(currentPrice);
      const firstPrice = visibleKlines[0]?.open || currentPrice;
      const isUp = currentPrice >= firstPrice;
      const lineColor = isUp ? "#0ecb81" : "#f6465d";

      ctx.save();
      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = lineColor;
      ctx.lineWidth = 1.3;

      ctx.beginPath();
      ctx.moveTo(paddingLeft, currentY);
      ctx.lineTo(width - paddingRight, currentY);
      ctx.stroke();
      ctx.restore();

      // Draw Badge on the Right Price Axis
      const badgeHeight = 24;
      const badgeWidth = paddingRight - 6;
      const badgeX = width - paddingRight + 3;
      const badgeY = currentY - badgeHeight / 2;

      ctx.fillStyle = lineColor;
      ctx.beginPath();
      ctx.roundRect(badgeX, badgeY, badgeWidth, badgeHeight, 5);
      ctx.fill();

      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 12px Inter, monospace";
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillText(formatPrice(currentPrice), badgeX + 5, currentY);
    }

    // 8. Draw Active Price Alert Lines
    if (alerts && alerts.length > 0) {
      alerts.forEach((alert) => {
        if (!alert.active || alert.triggered || alert.symbol !== symbol) return;
        const alertY = getY(alert.targetPrice);
        if (alertY < paddingTop || alertY > height - paddingBottom) return;

        ctx.save();
        ctx.setLineDash([5, 3]);
        ctx.strokeStyle = "#f59e0b";
        ctx.lineWidth = 1.3;

        ctx.beginPath();
        ctx.moveTo(paddingLeft, alertY);
        ctx.lineTo(width - paddingRight, alertY);
        ctx.stroke();
        ctx.restore();

        const badgeHeight = 18;
        const badgeWidth = paddingRight - 6;
        const badgeX = width - paddingRight + 3;
        const badgeY = alertY - badgeHeight / 2;

        ctx.fillStyle = "#f59e0b";
        ctx.beginPath();
        ctx.roundRect(badgeX, badgeY, badgeWidth, badgeHeight, 3);
        ctx.fill();

        ctx.fillStyle = "#000000";
        ctx.font = "bold 10px Inter, monospace";
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
        ctx.fillText(`ALERT: ${formatPrice(alert.targetPrice)}`, badgeX + 3, alertY);
      });
    }

    // 9. Crosshair on mouse hover
    if (mousePos && mousePos.x >= paddingLeft && mousePos.x <= width - paddingRight) {
      const hoverX = mousePos.x;
      const hoverY = mousePos.y;

      ctx.save();
      ctx.setLineDash([2, 2]);
      ctx.strokeStyle = "rgba(148, 163, 184, 0.4)";
      ctx.lineWidth = 1;

      // Vertical line
      ctx.beginPath();
      ctx.moveTo(hoverX, paddingTop);
      ctx.lineTo(hoverX, height - paddingBottom);
      ctx.stroke();

      // Horizontal line
      ctx.beginPath();
      ctx.moveTo(paddingLeft, hoverY);
      ctx.lineTo(width - paddingRight, hoverY);
      ctx.stroke();
      ctx.restore();

      // Price on hover Y
      if (hoverY >= paddingTop && hoverY <= height - paddingBottom) {
        const cursorPrice = minPrice + ((paddingTop + priceChartHeight - hoverY) / priceChartHeight) * adjustedRange;

        ctx.fillStyle = "#1e293b";
        ctx.fillRect(width - paddingRight + 2, hoverY - 9, paddingRight - 4, 18);
        ctx.fillStyle = "#f8fafc";
        ctx.font = "10px Inter, monospace";
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
        ctx.fillText(formatPrice(cursorPrice), width - paddingRight + 6, hoverY);
      }
    }
  }, [
    klines,
    currentPrice,
    symbol,
    decimals,
    interval,
    mousePos,
    signalMarkers,
    showSignals,
    tatsData,
    showCloud,
    showLevels,
    showEMAs,
    alerts,
    visibleCount,
    panOffset,
    formatPrice,
    formatTime,
    containerDimensions,
  ]);

  // Handle Mouse Events for Crosshair and Pan Drag
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    setIsDragging(true);
    dragStartRef.current = {
      clientX: e.clientX,
      initialOffset: panOffset,
    };
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setMousePos({ x, y });

    const paddingLeft = 12;
    const paddingRight = 100;
    const chartWidth = rect.width - paddingRight - paddingLeft;

    if (isDragging) {
      const deltaX = e.clientX - dragStartRef.current.clientX;
      const count = Math.min(klines.length, Math.max(12, visibleCount));
      const slotWidth = chartWidth / count;
      const candleShift = Math.round(deltaX / slotWidth);
      const maxOffset = Math.max(0, klines.length - count);
      const nextOffset = Math.max(0, Math.min(maxOffset, dragStartRef.current.initialOffset + candleShift));
      setPanOffset(nextOffset);
    }

    if (klines.length > 0 && x >= paddingLeft && x <= rect.width - paddingRight) {
      const count = Math.min(klines.length, Math.max(12, visibleCount));
      const maxOffset = Math.max(0, klines.length - count);
      const clampedOffset = Math.min(maxOffset, Math.max(0, panOffset));
      const endIndex = klines.length - clampedOffset;
      const startIndex = Math.max(0, endIndex - count);

      const slot = chartWidth / count;
      const visibleIdx = Math.min(count - 1, Math.max(0, Math.floor((x - paddingLeft) / slot)));
      const globalIdx = startIndex + visibleIdx;
      setHoveredCandleIndex(globalIdx);
    } else {
      setHoveredCandleIndex(null);
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleMouseLeave = () => {
    setIsDragging(false);
    setMousePos(null);
    setHoveredCandleIndex(null);
  };

  const activeCandle =
    hoveredCandleIndex !== null && klines[hoveredCandleIndex]
      ? klines[hoveredCandleIndex]
      : klines[klines.length - 1];
  const isCandleBull = activeCandle ? activeCandle.close >= activeCandle.open : true;
  const candleChange = activeCandle ? ((activeCandle.close - activeCandle.open) / activeCandle.open) * 100 : 0;

  const defaultCount = Math.min(Math.max(klines.length, 10), 45);
  const zoomPercent = Math.round((defaultCount / Math.max(12, visibleCount)) * 100);

  return (
    <div
      ref={containerRef}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
      className={`relative w-full h-full select-none overflow-hidden ${
        isDragging ? "cursor-grabbing" : "cursor-crosshair"
      }`}
    >
      <canvas ref={canvasRef} className="absolute inset-0 block" />

      {/* Floating Candlestick Stats Legend */}
      {activeCandle && (
        <div className="absolute top-2.5 left-3.5 z-10 flex flex-wrap items-center gap-3 bg-[#0a0d14]/85 backdrop-blur-md px-3 py-1.5 rounded-lg border border-slate-700/70 text-xs font-mono pointer-events-none shadow-lg">
          <span className="text-white font-extrabold flex items-center gap-1.5">
            <span>{symbol}</span>
            <span className="text-blue-300 bg-blue-900/80 px-1 py-0.2 rounded border border-blue-700/50 text-[11px] font-bold">
              {interval}
            </span>
          </span>
          <span className="text-slate-300 font-medium">
            O: <span className={isCandleBull ? "text-emerald-400 font-bold" : "text-rose-400 font-bold"}>${formatPrice(activeCandle.open)}</span>
          </span>
          <span className="text-slate-300 font-medium">
            H: <span className={isCandleBull ? "text-emerald-400 font-bold" : "text-rose-400 font-bold"}>${formatPrice(activeCandle.high)}</span>
          </span>
          <span className="text-slate-300 font-medium">
            L: <span className={isCandleBull ? "text-emerald-400 font-bold" : "text-rose-400 font-bold"}>${formatPrice(activeCandle.low)}</span>
          </span>
          <span className="text-slate-300 font-medium">
            C: <span className={isCandleBull ? "text-emerald-400 font-bold" : "text-rose-400 font-bold"}>${formatPrice(activeCandle.close)}</span>
          </span>
          <span className={`font-bold ${isCandleBull ? "text-emerald-400" : "text-rose-400"}`}>
            {candleChange >= 0 ? "+" : ""}
            {candleChange.toFixed(2)}%
          </span>
          {tatsData && (
            <span className="text-slate-400 font-bold border-l border-slate-700 pl-2">
              ATR: <span className="text-amber-400">{tatsData.atrPct}%</span>
            </span>
          )}
        </div>
      )}

      {/* Floating TATS PRO Live Targets & Risk Bar (Entry, SL, TP1-TP7) */}
      {showLevels && tatsData && tatsData.entryPrice > 0 && (
        <div className="absolute top-11 left-3.5 z-10 hidden md:flex items-center gap-1.5 bg-[#0a0d14]/92 backdrop-blur-md px-3 py-1.5 rounded-lg border border-slate-700/80 text-[11px] font-mono shadow-2xl overflow-x-auto max-w-[calc(100vw-220px)] scrollbar-none">
          <div className="flex items-center gap-1 text-slate-300 font-bold border-r border-slate-700/80 pr-2 shrink-0">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-white font-black">TATS LEVELS:</span>
          </div>

          <div className="flex items-center gap-1 bg-slate-900 px-2 py-0.5 rounded border border-slate-700/60 shrink-0">
            <span className="text-slate-400 text-[10px]">ENTRY:</span>
            <span className="text-white font-bold">${formatPrice(tatsData.entryPrice)}</span>
          </div>

          <div className="flex items-center gap-1 bg-rose-950/70 px-2 py-0.5 rounded border border-rose-800/60 shrink-0">
            <span className="text-rose-300 text-[10px]">SL:</span>
            <span className="text-rose-400 font-bold">${formatPrice(tatsData.stopLoss)}</span>
          </div>

          <div className="h-3 w-px bg-slate-700 shrink-0" />

          {/* TP1 to TP7 Targets */}
          <div className="flex items-center gap-1 shrink-0">
            {tatsData.tpTargets.map((tp, idx) => {
              const multiple = idx + 1;
              const isBull = tatsData.lastSide === 1;
              const isHit = isBull ? currentPrice >= tp : currentPrice <= tp;
              return (
                <div
                  key={idx}
                  className={`flex items-center gap-1 px-1.5 py-0.5 rounded border text-[10.5px] font-bold ${
                    isHit
                      ? "bg-emerald-500 text-black border-emerald-400 font-black animate-pulse shadow-md shadow-emerald-500/30"
                      : "bg-emerald-950/60 text-emerald-300 border-emerald-800/60"
                  }`}
                  title={`TP${multiple} Target: $${formatPrice(tp)}`}
                >
                  <span className={isHit ? "text-black font-black" : "text-emerald-400 font-bold"}>TP{multiple}:</span>
                  <span>${formatPrice(tp)}</span>
                  {isHit && <span className="text-[10px] font-black uppercase">HIT</span>}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Top-Right: TATS PRO Controls HUD */}
      <div className="absolute top-2.5 right-20 z-10 flex items-center gap-1.5 bg-[#0b0e16]/90 backdrop-blur-md p-1 rounded-lg border border-slate-700/70 shadow-xl text-xs">
        {/* Toggle TATS 6-EMA Cloud */}
        <button
          onClick={() => setShowCloud(!showCloud)}
          className={`flex items-center gap-1 px-2.5 py-1 rounded-md font-bold transition-all cursor-pointer ${
            showCloud
              ? "bg-cyan-950/80 text-cyan-300 border border-cyan-500/40"
              : "text-slate-400 hover:text-white"
          }`}
          title="Toggle TATS PRO 6-EMA Trend Cloud (EMA 30 to 60)"
        >
          <Layers size={13} className={showCloud ? "text-cyan-400" : "text-slate-500"} />
          <span>Cloud: {showCloud ? "ON" : "OFF"}</span>
        </button>

        {/* Toggle TATS Target Levels (Entry, SL, TP1-TP7) */}
        <button
          onClick={() => setShowLevels(!showLevels)}
          className={`flex items-center gap-1 px-2.5 py-1 rounded-md font-bold transition-all cursor-pointer ${
            showLevels
              ? "bg-emerald-950/80 text-emerald-300 border border-emerald-500/40"
              : "text-slate-400 hover:text-white"
          }`}
          title="Toggle TATS PRO Risk Levels (Entry, SL, TP1-TP7)"
        >
          <Eye size={13} className={showLevels ? "text-emerald-400" : "text-slate-500"} />
          <span>Levels: {showLevels ? "ON" : "OFF"}</span>
        </button>

        {/* Toggle Intermediate EMAs */}
        <button
          onClick={() => setShowEMAs(!showEMAs)}
          className={`flex items-center gap-1 px-2 py-1 rounded-md font-bold transition-all cursor-pointer ${
            showEMAs
              ? "bg-purple-950/80 text-purple-300 border border-purple-500/40"
              : "text-slate-400 hover:text-white"
          }`}
          title="Toggle Intermediate EMAs (35, 40, 45, 50)"
        >
          <span>EMAs: {showEMAs ? "6-All" : "Fast/Slow"}</span>
        </button>

        {/* Toggle Chart Buy/Sell Markers */}
        <button
          onClick={onToggleSignals}
          className={`flex items-center gap-1 px-2.5 py-1 rounded-md font-bold transition-all cursor-pointer ${
            showSignals
              ? "bg-blue-950/80 text-blue-300 border border-blue-500/40"
              : "text-slate-400 hover:text-white"
          }`}
          title="Toggle TATS BUY/SELL Signal Arrows on Chart"
        >
          <span className={`w-1.5 h-1.5 rounded-full ${showSignals ? "bg-blue-400 animate-pulse" : "bg-slate-500"}`} />
          <span>Signals</span>
        </button>
      </div>

      {/* Bottom-Right Floating Zoom & Pan Controls */}
      <div className="absolute bottom-9 right-20 z-20 flex items-center gap-1 bg-[#10141e]/90 backdrop-blur-md border border-[#222b3d] p-1 rounded-lg shadow-xl text-slate-300">
        <button
          onClick={handleZoomIn}
          className="p-1.5 hover:bg-[#1f283b] hover:text-white rounded transition-colors cursor-pointer"
          title="Zoom In (Scroll Up)"
        >
          <ZoomIn size={14} />
        </button>

        <button
          onClick={handleZoomOut}
          className="p-1.5 hover:bg-[#1f283b] hover:text-white rounded transition-colors cursor-pointer"
          title="Zoom Out (Scroll Down)"
        >
          <ZoomOut size={14} />
        </button>

        <div className="h-3.5 w-px bg-slate-700 mx-0.5" />

        <span className="text-[10px] font-mono px-1 font-bold text-slate-400" title="Zoom Level">
          {zoomPercent}%
        </span>

        {panOffset > 0 && (
          <span className="text-[9px] font-mono bg-blue-950 text-blue-300 px-1 py-0.5 rounded border border-blue-800/40">
            Pan: -{panOffset}
          </span>
        )}

        <button
          onClick={handleResetZoom}
          className="p-1.5 hover:bg-[#1f283b] hover:text-white rounded transition-colors cursor-pointer"
          title="Reset Zoom & Center Live Candle"
        >
          <RotateCcw size={13} />
        </button>
      </div>

      {/* Loading Indicator Overlay */}
      {isLoading && (
        <div className="absolute inset-0 bg-black/40 backdrop-blur-[1px] flex items-center justify-center z-20 pointer-events-none">
          <div className="bg-[#121620] border border-blue-500/40 text-blue-300 px-3.5 py-1.5 rounded-lg flex items-center gap-2 text-xs font-mono shadow-2xl">
            <Clock size={14} className="animate-spin text-blue-400" />
            <span>Switching to {interval} chart...</span>
          </div>
        </div>
      )}
    </div>
  );
};
