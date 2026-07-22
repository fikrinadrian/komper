import { Chart, type ChartOptions } from '@highcharts/react';
import { Accessibility } from '@highcharts/react/modules/Accessibility';
import type { MarketChartPeriod, Venue } from '@shared/contracts.js';
import type { AbsoluteChartModel } from '@client/lib/market-chart.js';

const VENUE_LABEL: Record<Venue, string> = {
  INDODAX: 'Indodax',
  REKU: 'Reku',
  TOKOCRYPTO: 'Tokocrypto',
};

const VENUE_COLOR_TOKEN: Record<Venue, { token: string; fallback: string }> = {
  INDODAX: { token: '--chart-indodax', fallback: '#22d3ee' },
  REKU: { token: '--chart-reku', fallback: '#f472b6' },
  TOKOCRYPTO: { token: '--chart-tokocrypto', fallback: '#4ade80' },
};

const VENUE_DASH: Record<Venue, 'Solid' | 'ShortDash' | 'ShortDot'> = {
  INDODAX: 'Solid',
  REKU: 'ShortDash',
  TOKOCRYPTO: 'ShortDot',
};

const VENUE_LINE_LABEL: Record<Venue, string> = {
  INDODAX: 'garis solid',
  REKU: 'garis putus panjang',
  TOKOCRYPTO: 'garis titik pendek',
};

function cssValue(token: string, fallback: string): string {
  if (typeof document === 'undefined') return fallback;
  return getComputedStyle(document.documentElement).getPropertyValue(token).trim() || fallback;
}

function cssRgb(token: string, fallback: string): string {
  const value = cssValue(token, '');
  return value ? `rgb(${value.split(/\s+/).join(', ')})` : fallback;
}

export function HighchartsPriceChart({
  pair,
  period,
  model,
  comparisonEligible,
}: {
  pair: string;
  period: MarketChartPeriod;
  model: AbsoluteChartModel;
  comparisonEligible: boolean;
}) {
  const pairLabel = pair.replace('-', '/').toUpperCase();
  const theme = {
    foreground: cssRgb('--color-foreground', '#f2f8ff'),
    muted: cssRgb('--color-muted', '#a6bcd3'),
    surface: cssRgb('--color-surface', '#0b1224'),
    surfaceStrong: cssRgb('--color-surface-strong', '#071426'),
    border: cssRgb('--color-border', '#365a80'),
    primary: cssRgb('--color-primary', '#22d3ee'),
  };
  const options: ChartOptions = {
    chart: {
      type: 'line',
      height: 410,
      backgroundColor: theme.surface,
      plotBackgroundColor: theme.surface,
      spacing: [16, 8, 12, 8],
      animation: false,
      style: { fontFamily: 'JetBrains Mono, ui-monospace, monospace' },
    },
    title: {
      text: comparisonEligible
        ? `Perbandingan harga close ${pairLabel} per exchange`
        : `Histori harga close ${pairLabel}`,
      style: {
        color: theme.foreground,
        fontFamily: 'Orbitron, ui-sans-serif, system-ui, sans-serif',
        fontSize: '16px',
        fontWeight: '700',
      },
    },
    credits: { enabled: false },
    time: { timezone: 'Asia/Jakarta' },
    xAxis: {
      type: 'datetime',
      title: { text: 'Waktu (WIB)', style: { color: theme.muted } },
      labels: { style: { color: theme.muted } },
      lineColor: theme.border,
      tickColor: theme.border,
    },
    yAxis: {
      title: { text: 'Last price / close (IDR)', style: { color: theme.muted } },
      gridLineColor: theme.border,
      gridLineDashStyle: 'ShortDot',
      labels: { format: 'Rp{value:,.0f}', style: { color: theme.muted } },
    },
    legend: {
      enabled: true,
      align: 'center',
      verticalAlign: 'top',
      itemStyle: { color: theme.foreground, fontWeight: '700' },
      itemHoverStyle: { color: theme.primary },
      itemHiddenStyle: { color: theme.muted, textDecoration: 'line-through' },
      symbolWidth: 34,
    },
    tooltip: {
      shared: true,
      backgroundColor: theme.surfaceStrong,
      borderColor: theme.primary,
      borderRadius: 4,
      shadow: false,
      style: { color: theme.foreground, fontSize: '12px' },
      xDateFormat: '%A, %d %b %Y %H:%M WIB',
      pointFormat:
        '<span style="color:{series.color}">●</span> <b>{series.name}</b><br/>' +
        'O Rp{point.custom.open:,.2f} · H Rp{point.custom.high:,.2f} · ' +
        'L Rp{point.custom.low:,.2f} · C Rp{point.y:,.2f}<br/>',
    },
    plotOptions: {
      line: {
        connectNulls: false,
        lineWidth: 3,
        marker: { enabled: false },
        states: { hover: { lineWidthPlus: 1 }, inactive: { opacity: 0.42 } },
      },
      series: {
        animation: false,
        events: {
          legendItemClick() {
            const hasData = this.points.some((point) => point.y !== null);
            const visibleDataSeries = this.chart.series.filter(
              (series) => series.visible && series.points.some((point) => point.y !== null),
            );
            if (this.visible && hasData && visibleDataSeries.length === 1) return false;
          },
        },
      },
    },
    series: model.series.map((item) => {
      const candles = new Map(item.candles.map((candle) => [Date.parse(candle.openedAt), candle]));
      return {
        type: 'line' as const,
        id: item.venue,
        name: VENUE_LABEL[item.venue],
        color: cssValue(
          VENUE_COLOR_TOKEN[item.venue].token,
          VENUE_COLOR_TOKEN[item.venue].fallback,
        ),
        dashStyle: VENUE_DASH[item.venue],
        data: item.points.map(([timestamp, close]) => {
          const candle = candles.get(timestamp);
          if (close === null || !candle) return [timestamp, null];
          return {
            x: timestamp,
            y: close,
            custom: {
              open: Number(candle.open),
              high: Number(candle.high),
              low: Number(candle.low),
            },
          };
        }),
        showInLegend: true,
        accessibility: {
          description: `${VENUE_LABEL[item.venue]}, ${VENUE_LINE_LABEL[item.venue]}, harga OHLC dalam rupiah.`,
        },
      };
    }),
  };

  return (
    <Chart options={options} containerProps={{ className: 'min-w-0 overflow-hidden' }}>
      <Accessibility
        enabled
        description={`${comparisonEligible ? 'Perbandingan' : 'Histori observasional'} last price berdasarkan close candle ${pairLabel} untuk periode ${period}.`}
        keyboardNavigation={{ enabled: true }}
        point={{ describeNull: true, valuePrefix: 'Rp' }}
      />
    </Chart>
  );
}
