import { describe, expect, it } from 'vitest';
import { evaluateFit } from '../engine/evaluator';
import { containsSkillPhrase, matchesWithBoundary, tokenizeText } from '../engine/tokenizer';
import type { JobPosting, ResumeProfile } from '../types';

function makeProfile(text: string): ResumeProfile {
  return {
    id: 'prof_test',
    label: 'Test',
    fileName: 'resume.pdf',
    format: 'pdf',
    text,
    wordCount: text.split(/\s+/).length,
    createdAt: Date.now(),
  };
}

function makeJob(title: string, description: string): JobPosting {
  return {
    title,
    description,
    url: 'https://example.com/jobs/123',
    platform: 'manual',
    capturedAt: Date.now(),
  };
}

describe('RoleFit tokenizer & boundary matching', () => {
  it('prevents substring false positives across short and overlapping tech terms', () => {
    const prose =
      'Built JavaScript frontends with strong algorithms. An inspired candidate fixed a warm alarm and stayed interested.';
    expect(matchesWithBoundary('java', prose)).toBe(false);
    expect(containsSkillPhrase('java', prose)).toBe(false);
    expect(containsSkillPhrase('go', prose)).toBe(false);
    expect(containsSkillPhrase('spi', prose)).toBe(false);
    expect(containsSkillPhrase('can', prose)).toBe(false);
    expect(containsSkillPhrase('arm', prose)).toBe(false);
    expect(containsSkillPhrase('rest', prose)).toBe(false);
  });

  it('distinguishes C, C++, and C# accurately', () => {
    expect(matchesWithBoundary('c', 'C++ and React developer')).toBe(false);
    expect(matchesWithBoundary('c', 'Firmware in C and C++')).toBe(true);
    expect(matchesWithBoundary('c++', 'Firmware in C/C++')).toBe(true);
    expect(matchesWithBoundary('c#', 'Services in C# and .NET')).toBe(true);
    expect(matchesWithBoundary('c#', 'Embedded C and C++')).toBe(false);
  });

  it('expands slash-separated technical terms while preserving atomic slash skills', () => {
    const tokens = tokenizeText('Skills: C/C++, I2C/SPI/UART, PyTorch/TensorFlow, CI/CD, TCP/IP.');
    expect(tokens).toEqual(
      expect.arrayContaining(['c', 'c++', 'i2c', 'spi', 'uart', 'pytorch', 'tensorflow', 'ci/cd', 'tcp/ip']),
    );
  });
});

describe('RoleFit evaluator', () => {
  it('resolves aliases bidirectionally and reports matchedVia cleanly', () => {
    const resume = makeProfile(
      'Embedded Engineer with C, C++, FreeRTOS, STM32, Bluetooth Low Energy, I2C, SPI, UART, Machine Learning, Kubernetes, Docker.',
    );
    const job = makeJob(
      'Embedded & Edge AI Engineer',
      'Requirements: C/C++, RTOS, STM32, BLE, I2C/SPI/UART, ML, K8s, Docker.',
    );

    const report = evaluateFit(resume, job);
    const matchedTerms = report.matchedSkills.map((s) => s.term);
    expect(matchedTerms).toEqual(expect.arrayContaining(['C', 'C++', 'BLE', 'STM32', 'Kubernetes', 'Machine Learning']));
    expect(report.score).toBeGreaterThanOrEqual(85);
    expect(report.grade).toBe('strong');
  });

  it('identifies gaps on a Deep Learning Systems JD cleanly', () => {
    const resume = makeProfile(
      'ECE student experienced in C, C++, Python, Linux, Embedded Systems, STM32, and BLE.',
    );
    const job = makeJob(
      'Deep Learning Systems Engineer',
      'Looking for C/C++, Python, Linux, CUDA, TensorRT, PyTorch, Jetson Orin, and Model Quantization.',
    );

    const report = evaluateFit(resume, job);
    const matched = report.matchedSkills.map((s) => s.term);
    const missing = report.missingSkills.map((s) => s.term);

    expect(matched).toEqual(expect.arrayContaining(['C', 'C++', 'Python', 'Linux']));
    expect(missing).toEqual(expect.arrayContaining(['CUDA', 'TensorRT', 'PyTorch', 'Jetson Orin']));
    expect(report.score).toBeGreaterThan(35);
    expect(report.score).toBeLessThan(65);
  });

  it('uses proportional weights so one missing soft skill does not collapse a strong tech match', () => {
    const resume = makeProfile('C, C++, Python, Linux, RTOS, STM32, I2C, SPI, UART, BLE, Git.');
    const job = makeJob(
      'Firmware Engineer',
      'Required: C, C++, Python, Linux, RTOS, STM32, I2C, SPI, UART, BLE, Git, Leadership.',
    );
    const report = evaluateFit(resume, job);
    expect(report.score).toBeGreaterThanOrEqual(90);
    expect(report.grade).toBe('strong');
  });

  it('does not confuse English "can", "go", "10 ms", or "SPI master" with CAN bus, Go, or Master Degree', () => {
    const resume = makeProfile(
      'Pursuing B.Tech in ECE. Implemented SPI master driver with 10 ms latency in C on STM32.',
    );
    const job = makeJob(
      'Embedded Engineer',
      "You can go far here! Seeking Bachelor's or Master's degree candidate with C and STM32.",
    );
    const report = evaluateFit(resume, job);
    const allTerms = [...report.matchedSkills, ...report.missingSkills].map((s) => s.term);
    const matchedTerms = report.matchedSkills.map((s) => s.term);
    const missingTerms = report.missingSkills.map((s) => s.term);

    expect(allTerms).not.toContain('CAN');
    expect(allTerms).not.toContain('Go');
    expect(matchedTerms).toContain('Bachelor Degree');
    expect(missingTerms).toContain('Master Degree');
  });
});
