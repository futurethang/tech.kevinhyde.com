# Bat Swing

A portable React component implementing a pull-back-and-release baseball bat swing interaction.

## The Interaction

1. User presses and drags downward on the component
2. A batter figure cocks the bat back, building tension
3. Visual feedback: tension ring, power meter, screen shake at high tension
4. On release: explosive swing animation with speed lines and impact flash
5. Haptic feedback via Vibration API on supported devices

## Usage

Copy `BatSwing.jsx` and `BatSwing.css` into your React project:

```jsx
import BatSwing from './BatSwing'
import './BatSwing.css'

function MyApp() {
  return (
    <BatSwing
      onSwing={(power) => console.log(`Swung at ${power * 100}% power`)}
      threshold={0.3}
    />
  )
}
```

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `onSwing` | `(power: number) => void` | - | Called on release with power 0-1 |
| `threshold` | `number` | `0.3` | Minimum pull ratio to trigger swing |
| `disabled` | `boolean` | `false` | Disables interaction |
| `children` | `ReactNode` | - | Optional content inside the hit zone |

## Development

```bash
pnpm install
pnpm dev
```

## Build

```bash
pnpm build
```
