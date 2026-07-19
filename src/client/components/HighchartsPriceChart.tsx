import { Chart, type ChartOptions } from '@highcharts/react';
import { Accessibility } from '@highcharts/react/modules/Accessibility';
import type { MarketChartPeriod, Venue } from '@shared/contracts.js';
import type { AbsoluteChartModel } from '@client/lib/market-chart.js';

const VENUE_LABEL: Record<Venue, string> = {
  INDODAX: 'Indodax',
  REKU: 'Reku',
  TOKOCRYPTO: 'Tokocrypto',
};

const VENUE_COLOR: Record<Venue, string> = {
  INDODAX: '#ff6b54',
  REKU: '#29c3a2',
  TOKOCRYPTO: '#6275d7',
};

const VENUE_DASH = {
  INDODAX: 'Solid',
  REKU: 'ShortDash',
  TOKOCRYPTO: 'Dot',
} as const;

const VENUE_LINE_LABEL: Record<Venue, string> = {
  INDODAX: 'garis solid',
  REKU: 'garis putus-putus',
  TOKOCRYPTO: 'garis titik-titik',
};

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
  const options: ChartOptions = {
    chart: {
      type: 'line',
      height: 410,
      backgroundColor: 'transparent',
      spacing: [16, 8, 12, 8],
      animation: false,
    },
    title: {
      text: comparisonEligible
        ? `Perbandingan harga close ${pairLabel} per exchange`
        : `Histori harga close ${pairLabel}`,
      style: { color: '#182338', fontSize: '16px', fontWeight: '800' },
    },
    credits: { enabled: false },
    time: { timezone: 'Asia/Jakarta' },
    xAxis: {
      type: 'datetime',
      title: { text: 'Waktu (WIB)' },
      lineColor: '#cbd5e1',
      tickColor: '#cbd5e1',
    },
    yAxis: {
      title: { text: 'Last price / close (IDR)' },
      gridLineColor: '#e2e8f0',
      labels: { format: 'Rp{value:,.0f}' },
    },
    legend: {
      enabled: true,
      align: 'center',
      verticalAlign: 'top',
      itemStyle: { color: '#182338', fontWeight: '700' },
    },
    tooltip: {
      shared: true,
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
        states: { hover: { lineWidthPlus: 1 } },
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
        color: VENUE_COLOR[item.venue],
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
