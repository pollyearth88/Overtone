import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Button } from './Button';
import { Chip } from './Chip';
import { IconButton } from './IconButton';
import { ProgressBar } from './ProgressBar';
import { StatPill } from './StatPill';
import { PlayIcon } from './icons';

describe('Button', () => {
  it('renders a real button that defaults to type="button"', () => {
    render(<Button>Play</Button>);
    const button = screen.getByRole('button', { name: 'Play' });
    expect(button).toHaveAttribute('type', 'button');
  });

  it('keeps a 44px minimum touch target', () => {
    render(<Button>Play</Button>);
    expect(screen.getByRole('button', { name: 'Play' }).className).toContain('min-h-11');
  });
});

describe('IconButton', () => {
  it('exposes its label as the accessible name', () => {
    render(<IconButton label="Replay the note" icon={<PlayIcon />} />);
    expect(screen.getByRole('button', { name: 'Replay the note' })).toBeInTheDocument();
  });

  it('hides the decorative icon from assistive tech', () => {
    const { container } = render(<IconButton label="Replay the note" icon={<PlayIcon />} />);
    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  });
});

describe('ProgressBar', () => {
  it('reports its value through the progressbar role', () => {
    render(<ProgressBar value={68} label="Scale degrees progress" />);
    const bar = screen.getByRole('progressbar', { name: 'Scale degrees progress' });
    expect(bar).toHaveAttribute('aria-valuenow', '68');
  });

  it('clamps out-of-range values', () => {
    render(<ProgressBar value={140} label="Over" />);
    expect(screen.getByRole('progressbar', { name: 'Over' })).toHaveAttribute(
      'aria-valuenow',
      '100',
    );

    render(<ProgressBar value={-20} label="Under" />);
    expect(screen.getByRole('progressbar', { name: 'Under' })).toHaveAttribute(
      'aria-valuenow',
      '0',
    );
  });
});

describe('StatPill and Chip', () => {
  it('shows both the value and its label', () => {
    render(<StatPill label="Accuracy" value="87%" />);
    expect(screen.getByText('87%')).toBeInTheDocument();
    expect(screen.getByText('Accuracy')).toBeInTheDocument();
  });

  it('renders chip content in monospace', () => {
    render(<Chip>C major</Chip>);
    expect(screen.getByText('C major').className).toContain('font-mono');
  });
});
