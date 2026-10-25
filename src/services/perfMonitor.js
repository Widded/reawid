// src/services/perfMonitor.js
// Lightweight, non-intrusive performance and resource monitor for ReaWid PDF & Reader engine.
// Strictly tracks timing, concurrent tasks, memory heuristics, and cache hit rates without sensitive data.

class PerformanceMonitor {
  constructor() {
    this.activeRenders = 0;
    this.activeOcrRequests = 0;
    this.pageTurns = [];
    this.canvasRenders = [];
    this.ocrDurations = [];
    this.cacheHits = 0;
    this.cacheMisses = 0;
    this.timeToFirstPage = null;
    this._inFlightTimers = new Map();
  }

  start(name) {
    this._inFlightTimers.set(name, performance.now());
  }

  end(name) {
    const startTime = this._inFlightTimers.get(name);
    if (!startTime) return 0;
    const duration = Math.round((performance.now() - startTime) * 100) / 100;
    this._inFlightTimers.delete(name);

    if (name === 'pdf_open_to_first_page') {
      this.timeToFirstPage = duration;
    } else if (name.startsWith('page_turn_')) {
      this.pageTurns.push(duration);
      if (this.pageTurns.length > 50) this.pageTurns.shift();
    } else if (name.startsWith('canvas_render_')) {
      this.canvasRenders.push(duration);
      if (this.canvasRenders.length > 50) this.canvasRenders.shift();
    } else if (name.startsWith('ocr_req_')) {
      this.ocrDurations.push(duration);
      if (this.ocrDurations.length > 50) this.ocrDurations.shift();
    }

    return duration;
  }

  trackRenderStart() {
    this.activeRenders++;
    return this.activeRenders;
  }

  trackRenderEnd() {
    this.activeRenders = Math.max(0, this.activeRenders - 1);
    return this.activeRenders;
  }

  trackOcrStart() {
    this.activeOcrRequests++;
    return this.activeOcrRequests;
  }

  trackOcrEnd() {
    this.activeOcrRequests = Math.max(0, this.activeOcrRequests - 1);
    return this.activeOcrRequests;
  }

  recordCacheHit() {
    this.cacheHits++;
  }

  recordCacheMiss() {
    this.cacheMisses++;
  }

  getAverage(arr) {
    if (!arr.length) return 0;
    const sum = arr.reduce((acc, v) => acc + v, 0);
    return Math.round((sum / arr.length) * 10) / 10;
  }

  getReport() {
    const totalCacheQueries = this.cacheHits + this.cacheMisses;
    const hitRate = totalCacheQueries > 0
      ? Math.round((this.cacheHits / totalCacheQueries) * 100)
      : 0;

    return {
      timeToFirstPageMs: this.timeToFirstPage,
      avgPageTurnLatencyMs: this.getAverage(this.pageTurns),
      avgCanvasRenderMs: this.getAverage(this.canvasRenders),
      avgOcrDurationMs: this.getAverage(this.ocrDurations),
      activeConcurrentRenders: this.activeRenders,
      activeConcurrentOcr: this.activeOcrRequests,
      cacheHitRatePercent: hitRate,
      cacheHits: this.cacheHits,
      cacheMisses: this.cacheMisses,
      redundantRendersAvoided: this.cacheHits
    };
  }

  reset() {
    this.activeRenders = 0;
    this.activeOcrRequests = 0;
    this.pageTurns = [];
    this.canvasRenders = [];
    this.ocrDurations = [];
    this.cacheHits = 0;
    this.cacheMisses = 0;
    this.timeToFirstPage = null;
    this._inFlightTimers.clear();
  }
}

export const perfMonitor = new PerformanceMonitor();

// Expose safe dev tools inspect hook in browser environment
if (typeof window !== 'undefined') {
  window.__REAWID_PERF__ = perfMonitor;
}
