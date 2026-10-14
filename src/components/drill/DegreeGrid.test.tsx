import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { DegreeGrid } from './DegreeGrid';
import { buildChoices, levelStarterCount, unlockedChoiceIds } from '@/lib/modes/scaleDegrees';

/** The grid as a level would hand it over. */
function choicesFor(level: number, carriedForward = true) {
  return buildChoices(
    level,
    unlockedChoiceIds(level, levelStarterCount(level, carriedForward), carriedForward),
  );
}

describe('locked buttons are unmistakably unavailable', () => {
  it('disables them, takes them out of the tab order and says so', () => {
    render(<DegreeGrid choices={choicesFor(6, false)} onAnswer={() => {}} keyMode="major" />);

    const locked = screen.getByRole('button', { name: /♭2, Ra, locked/ });
    expect(locked).toBeDisabled();
    expect(locked).toHaveAttribute('aria-disabled', 'true');
    expect(locked).toHaveAttribute('tabindex', '-1');
  });

  it('does not mark unlocked buttons as locked or disabled', () => {
    render(<DegreeGrid choices={choicesFor(6, false)} onAnswer={() => {}} keyMode="major" />);

    const unlocked = screen.getByRole('button', { name: /^1, Do, shortcut 1$/ });
    expect(unlocked).toBeEnabled();
    expect(unlocked).not.toHaveAttribute('aria-disabled');
  });

  it('ignores clicks on a locked button', async () => {
    const onAnswer = vi.fn();
    render(<DegreeGrid choices={choicesFor(6, false)} onAnswer={onAnswer} keyMode="major" />);

    await userEvent.click(screen.getByRole('button', { name: /♭2, Ra, locked/ }));
    expect(onAnswer).not.toHaveBeenCalled();
  });

  it('passes clicks through on an unlocked button', async () => {
    const onAnswer = vi.fn();
    render(<DegreeGrid choices={choicesFor(6, false)} onAnswer={onAnswer} keyMode="major" />);

    await userEvent.click(screen.getByRole('button', { name: /^5, Sol, shortcut 5$/ }));
    expect(onAnswer).toHaveBeenCalledWith('5');
  });

  it('shakes only the locked button whose shortcut was pressed', () => {
    const { container } = render(
      <DegreeGrid
        choices={choicesFor(6, false)}
        onAnswer={() => {}}
        keyMode="major"
        shakeId="b2"
        shakeNonce={1}
      />,
    );

    const shaking = container.querySelectorAll('.animate-shake');
    expect(shaking).toHaveLength(1);
    expect(shaking[0]).toHaveAccessibleName(/♭2/);
  });
});

describe('shortcut badges', () => {
  it('shows the bare number on a scale degree and the Shift glyph on an altered one', () => {
    render(<DegreeGrid choices={buildChoices(6)} onAnswer={() => {}} keyMode="major" />);

    // In a major key, 3 is plain and b3 needs Shift.
    expect(screen.getByRole('button', { name: /^3, Mi, shortcut 3$/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^♭3, Me, shortcut ⇧3$/ })).toBeInTheDocument();
  });

  it('flips which of the pair needs Shift in a minor key', () => {
    render(<DegreeGrid choices={buildChoices(7)} onAnswer={() => {}} keyMode="minor" />);

    // In a minor key it is the other way round: b3 is plain, 3 needs Shift.
    expect(screen.getByRole('button', { name: /^♭3, Me, shortcut 3$/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^♭7, Te, shortcut 7$/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^7, Ti, shortcut ⇧7$/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^6, La, shortcut ⇧6$/ })).toBeInTheDocument();
  });

  it('does not put a shortcut in a locked button’s label', () => {
    render(<DegreeGrid choices={choicesFor(6, false)} onAnswer={() => {}} keyMode="major" />);
    expect(screen.getByRole('button', { name: '♭2, Ra, locked' })).toBeInTheDocument();
  });
});

describe('grid layout by answer count', () => {
  const columnsOf = (container: HTMLElement) =>
    [...(container.firstElementChild?.classList ?? [])].find((name) =>
      name.startsWith('grid-cols-'),
    );

  it('puts 2 to 4 answers in a single row', () => {
    for (const [level, expected] of [
      [1, 'grid-cols-2'],
      [2, 'grid-cols-3'],
      [3, 'grid-cols-4'],
    ] as const) {
      const { container, unmount } = render(
        <DegreeGrid choices={buildChoices(level)} onAnswer={() => {}} keyMode="major" />,
      );
      expect(columnsOf(container), `level ${level}`).toBe(expected);
      unmount();
    }
  });

  it('puts 7 answers in two rows of four', () => {
    const { container } = render(
      <DegreeGrid choices={buildChoices(4)} onAnswer={() => {}} keyMode="major" />,
    );
    expect(screen.getAllByRole('button')).toHaveLength(7);
    expect(columnsOf(container)).toBe('grid-cols-4');
  });

  it('puts the minor level’s 9 answers in a 3x3 grid', () => {
    const { container } = render(
      <DegreeGrid choices={buildChoices(7)} onAnswer={() => {}} keyMode="minor" />,
    );
    expect(screen.getAllByRole('button')).toHaveLength(9);
    expect(columnsOf(container)).toBe('grid-cols-3');
  });

  it('puts the chromatic level’s 12 answers in a 4x3 grid', () => {
    const { container } = render(
      <DegreeGrid choices={buildChoices(6)} onAnswer={() => {}} keyMode="major" />,
    );
    expect(screen.getAllByRole('button')).toHaveLength(12);
    expect(columnsOf(container)).toBe('grid-cols-4');
  });
});

describe('button order', () => {
  it('reads by pitch in a minor level: 1 2 ♭3 4 5 ♭6 6 ♭7 7', () => {
    render(<DegreeGrid choices={buildChoices(7)} onAnswer={() => {}} keyMode="minor" />);

    const labels = screen
      .getAllByRole('button')
      .map((button) => button.getAttribute('aria-label')?.split(',')[0]);

    expect(labels).toEqual(['1', '2', '♭3', '4', '5', '♭6', '6', '♭7', '7']);
  });

  it('reads by pitch on the chromatic level', () => {
    render(<DegreeGrid choices={buildChoices(6)} onAnswer={() => {}} keyMode="major" />);

    const labels = screen
      .getAllByRole('button')
      .map((button) => button.getAttribute('aria-label')?.split(',')[0]);

    expect(labels).toEqual(['1', '♭2', '2', '♭3', '3', '4', '♯4', '5', '♭6', '6', '♭7', '7']);
  });
});
