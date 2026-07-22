/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/client/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        canvas: 'rgb(var(--color-canvas) / <alpha-value>)',
        surface: 'rgb(var(--color-surface) / <alpha-value>)',
        'surface-soft': 'rgb(var(--color-surface-soft) / <alpha-value>)',
        'surface-raised': 'rgb(var(--color-surface-raised) / <alpha-value>)',
        'surface-strong': 'rgb(var(--color-surface-strong) / <alpha-value>)',
        foreground: 'rgb(var(--color-foreground) / <alpha-value>)',
        muted: 'rgb(var(--color-muted) / <alpha-value>)',
        border: 'rgb(var(--color-border) / <alpha-value>)',
        primary: 'rgb(var(--color-primary) / <alpha-value>)',
        'primary-strong': 'rgb(var(--color-primary-strong) / <alpha-value>)',
        'primary-soft': 'rgb(var(--color-primary-soft) / <alpha-value>)',
        'on-primary': 'rgb(var(--color-on-primary) / <alpha-value>)',
        accent: 'rgb(var(--color-accent) / <alpha-value>)',
        'accent-soft': 'rgb(var(--color-accent-soft) / <alpha-value>)',
        success: 'rgb(var(--color-success) / <alpha-value>)',
        'success-soft': 'rgb(var(--color-success-soft) / <alpha-value>)',
        warning: 'rgb(var(--color-warning) / <alpha-value>)',
        'warning-soft': 'rgb(var(--color-warning-soft) / <alpha-value>)',
        'warning-strong': 'rgb(var(--color-warning-strong) / <alpha-value>)',
        danger: 'rgb(var(--color-danger) / <alpha-value>)',
        'danger-soft': 'rgb(var(--color-danger-soft) / <alpha-value>)',
        'danger-strong': 'rgb(var(--color-danger-strong) / <alpha-value>)',
        'status-unavailable': 'rgb(var(--color-status-unavailable) / <alpha-value>)',
        focus: 'rgb(var(--color-focus) / <alpha-value>)',
      },
      boxShadow: {
        panel: '0 20px 70px -38px rgb(0 0 0 / 0.9)',
        glow: '0 0 0 1px rgb(var(--color-primary) / 0.12), 0 16px 50px -32px rgb(var(--color-primary) / 0.55)',
        'glow-accent':
          '0 0 0 1px rgb(var(--color-accent) / 0.14), 0 16px 50px -34px rgb(var(--color-accent) / 0.52)',
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['Orbitron', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        data: ['JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'Consolas', 'monospace'],
      },
      transitionDuration: {
        ui: '200ms',
      },
    },
  },
  plugins: [],
};
