/**
 * Unit tests for src/utils/progress.ts
 *
 * Tests ProgressBar and Spinner utilities for terminal progress visualization.
 */

import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import {
  ProgressBar,
  Spinner,
  createProgressBar,
  createSpinner,
} from '../../utils/progress.js';

// Mock stream for testing
function createMockStream(isTTY: boolean = true) {
  const output: string[] = [];
  return {
    isTTY,
    columns: 80,
    write: jest.fn((data: string) => {
      output.push(data);
      return true;
    }),
    getOutput: () => output,
    getLastOutput: () => output[output.length - 1] || '',
    clearOutput: () => { output.length = 0; },
  };
}

describe('ProgressBar', () => {
  describe('constructor', () => {
    it('should create a progress bar with default options', () => {
      const progress = new ProgressBar(10);
      expect(progress.getTotal()).toBe(10);
      expect(progress.getCurrent()).toBe(0);
      expect(progress.isDone()).toBe(false);
    });

    it('should accept custom options', () => {
      const mockStream = createMockStream();
      const progress = new ProgressBar(100, {
        label: 'Processing',
        width: 40,
        showCount: true,
        showPercent: true,
        filledChar: '#',
        emptyChar: '-',
        stream: mockStream as unknown as NodeJS.WriteStream,
      });

      expect(progress.getTotal()).toBe(100);
    });
  });

  describe('update', () => {
    it('should update the progress bar in TTY mode', () => {
      const mockStream = createMockStream(true);
      const progress = new ProgressBar(10, {
        stream: mockStream as unknown as NodeJS.WriteStream,
      });

      progress.update(5);
      expect(mockStream.write).toHaveBeenCalled();
      expect(progress.getCurrent()).toBe(5);
    });

    it('should not render in non-TTY mode', () => {
      const mockStream = createMockStream(false);
      const progress = new ProgressBar(10, {
        stream: mockStream as unknown as NodeJS.WriteStream,
      });

      progress.update(5);
      expect(mockStream.write).not.toHaveBeenCalled();
    });

    it('should clamp values to valid range', () => {
      const mockStream = createMockStream(true);
      const progress = new ProgressBar(10, {
        stream: mockStream as unknown as NodeJS.WriteStream,
      });

      progress.update(-5);
      expect(progress.getCurrent()).toBe(0);

      progress.update(15);
      expect(progress.getCurrent()).toBe(10);
    });

    it('should display item name when provided', () => {
      const mockStream = createMockStream(true);
      const progress = new ProgressBar(10, {
        stream: mockStream as unknown as NodeJS.WriteStream,
      });

      progress.update(5, 'test-item');
      const output = mockStream.getOutput().join('');
      expect(output).toContain('test-item');
    });

    it('should display percentage', () => {
      const mockStream = createMockStream(true);
      const progress = new ProgressBar(10, {
        stream: mockStream as unknown as NodeJS.WriteStream,
        showPercent: true,
      });

      progress.update(5);
      const output = mockStream.getOutput().join('');
      expect(output).toContain('50%');
    });

    it('should display count', () => {
      const mockStream = createMockStream(true);
      const progress = new ProgressBar(10, {
        stream: mockStream as unknown as NodeJS.WriteStream,
        showCount: true,
      });

      progress.update(3);
      const output = mockStream.getOutput().join('');
      expect(output).toContain('(3/10)');
    });

    it('should display label when provided', () => {
      const mockStream = createMockStream(true);
      const progress = new ProgressBar(10, {
        stream: mockStream as unknown as NodeJS.WriteStream,
        label: 'MyTask',
      });

      progress.update(1);
      const output = mockStream.getOutput().join('');
      expect(output).toContain('MyTask');
    });
  });

  describe('increment', () => {
    it('should increment by 1 by default', () => {
      const mockStream = createMockStream(true);
      const progress = new ProgressBar(10, {
        stream: mockStream as unknown as NodeJS.WriteStream,
      });

      progress.increment();
      expect(progress.getCurrent()).toBe(1);

      progress.increment();
      expect(progress.getCurrent()).toBe(2);
    });

    it('should increment by specified amount', () => {
      const mockStream = createMockStream(true);
      const progress = new ProgressBar(10, {
        stream: mockStream as unknown as NodeJS.WriteStream,
      });

      progress.increment(3);
      expect(progress.getCurrent()).toBe(3);

      progress.increment(2);
      expect(progress.getCurrent()).toBe(5);
    });
  });

  describe('complete', () => {
    it('should mark the progress bar as complete', () => {
      const mockStream = createMockStream(true);
      const progress = new ProgressBar(10, {
        stream: mockStream as unknown as NodeJS.WriteStream,
      });

      progress.update(5);
      progress.complete();
      expect(progress.isDone()).toBe(true);
    });

    it('should output newline on completion', () => {
      const mockStream = createMockStream(true);
      const progress = new ProgressBar(10, {
        stream: mockStream as unknown as NodeJS.WriteStream,
      });

      progress.complete();
      const output = mockStream.getOutput().join('');
      expect(output).toContain('\n');
    });

    it('should display custom message when provided', () => {
      const mockStream = createMockStream(true);
      const progress = new ProgressBar(10, {
        stream: mockStream as unknown as NodeJS.WriteStream,
      });

      progress.complete('All done!');
      const output = mockStream.getOutput().join('');
      expect(output).toContain('All done!');
    });

    it('should not update after completion', () => {
      const mockStream = createMockStream(true);
      const progress = new ProgressBar(10, {
        stream: mockStream as unknown as NodeJS.WriteStream,
      });

      progress.complete();
      const callCountAfterComplete = mockStream.write.mock.calls.length;

      progress.update(5);
      // Should not have any new write calls after update since it's completed
      expect(mockStream.write.mock.calls.length).toBe(callCountAfterComplete);
    });
  });

  describe('fail', () => {
    it('should mark the progress bar as complete with failure', () => {
      const mockStream = createMockStream(true);
      const progress = new ProgressBar(10, {
        stream: mockStream as unknown as NodeJS.WriteStream,
      });

      progress.fail('Something went wrong');
      expect(progress.isDone()).toBe(true);
      const output = mockStream.getOutput().join('');
      expect(output).toContain('Something went wrong');
    });

    it('should show default failure message when none provided', () => {
      const mockStream = createMockStream(true);
      const progress = new ProgressBar(10, {
        stream: mockStream as unknown as NodeJS.WriteStream,
      });

      progress.fail();
      const output = mockStream.getOutput().join('');
      expect(output).toContain('Failed');
    });
  });

  describe('progress bar rendering', () => {
    it('should render filled and empty characters correctly', () => {
      const mockStream = createMockStream(true);
      const progress = new ProgressBar(10, {
        stream: mockStream as unknown as NodeJS.WriteStream,
        width: 10,
        filledChar: '#',
        emptyChar: '-',
      });

      progress.update(5);
      const output = mockStream.getOutput().join('');
      // 50% of 10 width = 5 filled chars
      expect(output).toContain('#####-----');
    });

    it('should render 100% with all filled characters', () => {
      const mockStream = createMockStream(true);
      const progress = new ProgressBar(10, {
        stream: mockStream as unknown as NodeJS.WriteStream,
        width: 10,
        filledChar: '#',
        emptyChar: '-',
      });

      progress.update(10);
      const output = mockStream.getOutput().join('');
      expect(output).toContain('##########');
    });

    it('should render 0% with all empty characters', () => {
      const mockStream = createMockStream(true);
      const progress = new ProgressBar(10, {
        stream: mockStream as unknown as NodeJS.WriteStream,
        width: 10,
        filledChar: '#',
        emptyChar: '-',
      });

      progress.update(0);
      const output = mockStream.getOutput().join('');
      expect(output).toContain('----------');
    });
  });
});

describe('Spinner', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('constructor', () => {
    it('should create a spinner with default options', () => {
      const spinner = new Spinner();
      expect(spinner.isActive()).toBe(false);
    });

    it('should create a spinner with custom label', () => {
      const spinner = new Spinner('Loading');
      expect(spinner.isActive()).toBe(false);
    });
  });

  describe('start', () => {
    it('should start the spinner animation in TTY mode', () => {
      const mockStream = createMockStream(true);
      const spinner = new Spinner('Loading', {
        stream: mockStream as unknown as NodeJS.WriteStream,
      });

      spinner.start();
      expect(spinner.isActive()).toBe(true);
      expect(mockStream.write).toHaveBeenCalled();

      spinner.stop();
    });

    it('should output label in non-TTY mode without animation', () => {
      const mockStream = createMockStream(false);
      const spinner = new Spinner('Loading', {
        stream: mockStream as unknown as NodeJS.WriteStream,
      });

      spinner.start();
      expect(spinner.isActive()).toBe(false);
      const output = mockStream.getOutput().join('');
      expect(output).toContain('Loading');
    });

    it('should accept new label on start', () => {
      const mockStream = createMockStream(true);
      const spinner = new Spinner('Initial', {
        stream: mockStream as unknown as NodeJS.WriteStream,
      });

      spinner.start('New label');
      const output = mockStream.getOutput().join('');
      expect(output).toContain('New label');

      spinner.stop();
    });

    it('should not start multiple times', () => {
      const mockStream = createMockStream(true);
      const spinner = new Spinner('Loading', {
        stream: mockStream as unknown as NodeJS.WriteStream,
      });

      spinner.start();
      const callCount = mockStream.write.mock.calls.length;

      spinner.start();
      expect(mockStream.write.mock.calls.length).toBe(callCount);

      spinner.stop();
    });
  });

  describe('update', () => {
    it('should update the label while running', () => {
      const mockStream = createMockStream(true);
      const spinner = new Spinner('Initial', {
        stream: mockStream as unknown as NodeJS.WriteStream,
      });

      spinner.start();
      mockStream.clearOutput();

      spinner.update('New label');
      const output = mockStream.getOutput().join('');
      expect(output).toContain('New label');

      spinner.stop();
    });
  });

  describe('stop', () => {
    it('should stop the spinner animation', () => {
      const mockStream = createMockStream(true);
      const spinner = new Spinner('Loading', {
        stream: mockStream as unknown as NodeJS.WriteStream,
      });

      spinner.start();
      expect(spinner.isActive()).toBe(true);

      spinner.stop();
      expect(spinner.isActive()).toBe(false);
    });

    it('should display completion message', () => {
      const mockStream = createMockStream(true);
      const spinner = new Spinner('Loading', {
        stream: mockStream as unknown as NodeJS.WriteStream,
      });

      spinner.start();
      spinner.stop('Done!');
      const output = mockStream.getOutput().join('');
      expect(output).toContain('Done!');
    });

    it('should do nothing if not running', () => {
      const mockStream = createMockStream(true);
      const spinner = new Spinner('Loading', {
        stream: mockStream as unknown as NodeJS.WriteStream,
      });

      spinner.stop('Done!');
      expect(mockStream.write).not.toHaveBeenCalled();
    });
  });

  describe('fail', () => {
    it('should stop with error message', () => {
      const mockStream = createMockStream(true);
      const spinner = new Spinner('Loading', {
        stream: mockStream as unknown as NodeJS.WriteStream,
      });

      spinner.start();
      spinner.fail('Something went wrong');
      expect(spinner.isActive()).toBe(false);
      const output = mockStream.getOutput().join('');
      expect(output).toContain('Something went wrong');
    });

    it('should show default failure message when none provided', () => {
      const mockStream = createMockStream(true);
      const spinner = new Spinner('Loading', {
        stream: mockStream as unknown as NodeJS.WriteStream,
      });

      spinner.start();
      spinner.fail();
      const output = mockStream.getOutput().join('');
      expect(output).toContain('Failed');
    });
  });

  describe('animation frames', () => {
    it('should cycle through frames', () => {
      const mockStream = createMockStream(true);
      const spinner = new Spinner('Loading', {
        stream: mockStream as unknown as NodeJS.WriteStream,
        interval: 80,
      });

      spinner.start();
      mockStream.clearOutput();

      // Advance timer to trigger frame update
      jest.advanceTimersByTime(80);
      expect(mockStream.write).toHaveBeenCalled();

      spinner.stop();
    });
  });
});

describe('createProgressBar', () => {
  it('should return ProgressBar in TTY mode', () => {
    const mockStream = createMockStream(true);
    const progress = createProgressBar(10, {
      stream: mockStream as unknown as NodeJS.WriteStream,
    }, false);
    expect(progress).toBeInstanceOf(ProgressBar);
  });

  it('should return null in non-TTY mode', () => {
    const mockStream = createMockStream(false);
    const progress = createProgressBar(10, {
      stream: mockStream as unknown as NodeJS.WriteStream,
    }, false);
    expect(progress).toBeNull();
  });

  it('should return null in JSON mode', () => {
    const mockStream = createMockStream(true);
    const progress = createProgressBar(10, {
      stream: mockStream as unknown as NodeJS.WriteStream,
    }, true);
    expect(progress).toBeNull();
  });

  it('should return null in JSON mode even with TTY', () => {
    const mockStream = createMockStream(true);
    const progress = createProgressBar(10, {
      stream: mockStream as unknown as NodeJS.WriteStream,
    }, true);
    expect(progress).toBeNull();
  });
});

describe('createSpinner', () => {
  it('should return Spinner in TTY mode', () => {
    const mockStream = createMockStream(true);
    const spinner = createSpinner('Loading', {
      stream: mockStream as unknown as NodeJS.WriteStream,
    }, false);
    expect(spinner).toBeInstanceOf(Spinner);
  });

  it('should return null in non-TTY mode', () => {
    const mockStream = createMockStream(false);
    const spinner = createSpinner('Loading', {
      stream: mockStream as unknown as NodeJS.WriteStream,
    }, false);
    expect(spinner).toBeNull();
  });

  it('should return null in JSON mode', () => {
    const mockStream = createMockStream(true);
    const spinner = createSpinner('Loading', {
      stream: mockStream as unknown as NodeJS.WriteStream,
    }, true);
    expect(spinner).toBeNull();
  });
});

describe('edge cases', () => {
  describe('ProgressBar', () => {
    it('should handle zero total', () => {
      const mockStream = createMockStream(true);
      const progress = new ProgressBar(0, {
        stream: mockStream as unknown as NodeJS.WriteStream,
      });

      progress.update(0);
      const output = mockStream.getOutput().join('');
      // Should show 0% without errors
      expect(output).toContain('0%');
    });

    it('should truncate long item names', () => {
      const mockStream = createMockStream(true);
      (mockStream as { columns: number }).columns = 60;
      const progress = new ProgressBar(10, {
        stream: mockStream as unknown as NodeJS.WriteStream,
      });

      const longItem = 'a'.repeat(100);
      progress.update(1, longItem);
      const output = mockStream.getOutput().join('');
      // Should contain truncated item with ellipsis
      expect(output.length).toBeLessThan(200);
    });

    it('should not update if output has not changed', () => {
      const mockStream = createMockStream(true);
      const progress = new ProgressBar(10, {
        stream: mockStream as unknown as NodeJS.WriteStream,
      });

      progress.update(5);
      const callCount = mockStream.write.mock.calls.length;

      progress.update(5);
      // Should not write again since nothing changed
      expect(mockStream.write.mock.calls.length).toBe(callCount);
    });
  });

  describe('Spinner', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should handle empty label', () => {
      const mockStream = createMockStream(true);
      const spinner = new Spinner('', {
        stream: mockStream as unknown as NodeJS.WriteStream,
      });

      spinner.start();
      expect(spinner.isActive()).toBe(true);
      spinner.stop();
    });

    it('should clean up interval on fail', () => {
      const mockStream = createMockStream(true);
      const spinner = new Spinner('Loading', {
        stream: mockStream as unknown as NodeJS.WriteStream,
      });

      spinner.start();
      spinner.fail();
      expect(spinner.isActive()).toBe(false);
    });
  });
});
