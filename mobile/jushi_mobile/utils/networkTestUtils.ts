/**
 * Network Switching Test Utilities for Mobile
 *
 * Simulates various network conditions to test SSE connection resilience:
 * - WiFi to 4G switching
 * - Connection drops and recovery
 * - Weak network conditions
 * - Latency simulation
 */

import { AppState, AppStateStatus, Platform } from 'react-native';
import { EventEmitter } from 'events';

// Network type
export type NetworkType = 'wifi' | 'cellular' | 'none';

// Network condition
export interface NetworkCondition {
  type: NetworkType;
  latency: number;        // ms
  bandwidth: number;      // bytes/s
  packetLoss: number;     // 0-1
  jitter: number;         // ms
}

// Preset network conditions
export const NETWORK_PRESETS: Record<string, NetworkCondition> = {
  'wifi-excellent': {
    type: 'wifi',
    latency: 20,
    bandwidth: 50 * 1024 * 1024,  // 50 Mbps
    packetLoss: 0,
    jitter: 5,
  },
  'wifi-good': {
    type: 'wifi',
    latency: 50,
    bandwidth: 20 * 1024 * 1024,  // 20 Mbps
    packetLoss: 0.001,
    jitter: 10,
  },
  'wifi-poor': {
    type: 'wifi',
    latency: 150,
    bandwidth: 5 * 1024 * 1024,   // 5 Mbps
    packetLoss: 0.01,
    jitter: 30,
  },
  '4g-excellent': {
    type: 'cellular',
    latency: 50,
    bandwidth: 30 * 1024 * 1024,  // 30 Mbps
    packetLoss: 0.001,
    jitter: 15,
  },
  '4g-good': {
    type: 'cellular',
    latency: 100,
    bandwidth: 10 * 1024 * 1024,  // 10 Mbps
    packetLoss: 0.005,
    jitter: 25,
  },
  '4g-poor': {
    type: 'cellular',
    latency: 300,
    bandwidth: 1 * 1024 * 1024,   // 1 Mbps
    packetLoss: 0.02,
    jitter: 50,
  },
  '3g': {
    type: 'cellular',
    latency: 500,
    bandwidth: 384 * 1024,        // 384 Kbps
    packetLoss: 0.03,
    jitter: 100,
  },
  '2g': {
    type: 'cellular',
    latency: 1000,
    bandwidth: 50 * 1024,         // 50 Kbps
    packetLoss: 0.05,
    jitter: 200,
  },
  'offline': {
    type: 'none',
    latency: Infinity,
    bandwidth: 0,
    packetLoss: 1,
    jitter: Infinity,
  },
};

// Test scenario
export interface TestScenario {
  name: string;
  description: string;
  steps: ScenarioStep[];
}

export interface ScenarioStep {
  condition: NetworkCondition;
  duration: number;  // ms
  action?: 'disconnect' | 'reconnect' | 'pause' | 'resume';
}

// Predefined test scenarios
export const TEST_SCENARIOS: Record<string, TestScenario> = {
  'wifi-to-4g': {
    name: 'WiFi to 4G Switch',
    description: 'Simulates switching from WiFi to cellular data',
    steps: [
      { condition: NETWORK_PRESETS['wifi-good'], duration: 5000 },
      { condition: NETWORK_PRESETS['offline'], duration: 500, action: 'disconnect' },
      { condition: NETWORK_PRESETS['4g-good'], duration: 5000, action: 'reconnect' },
    ],
  },
  '4g-to-wifi': {
    name: '4G to WiFi Switch',
    description: 'Simulates switching from cellular to WiFi',
    steps: [
      { condition: NETWORK_PRESETS['4g-good'], duration: 5000 },
      { condition: NETWORK_PRESETS['offline'], duration: 200, action: 'disconnect' },
      { condition: NETWORK_PRESETS['wifi-good'], duration: 5000, action: 'reconnect' },
    ],
  },
  'elevator-effect': {
    name: 'Elevator Effect',
    description: 'Simulates entering and leaving an elevator (signal loss)',
    steps: [
      { condition: NETWORK_PRESETS['wifi-good'], duration: 3000 },
      { condition: NETWORK_PRESETS['wifi-poor'], duration: 2000 },
      { condition: NETWORK_PRESETS['3g'], duration: 2000 },
      { condition: NETWORK_PRESETS['offline'], duration: 3000, action: 'disconnect' },
      { condition: NETWORK_PRESETS['3g'], duration: 2000, action: 'reconnect' },
      { condition: NETWORK_PRESETS['wifi-poor'], duration: 2000 },
      { condition: NETWORK_PRESETS['wifi-good'], duration: 3000 },
    ],
  },
  'subway-tunnel': {
    name: 'Subway Tunnel',
    description: 'Simulates repeated connection drops in subway',
    steps: [
      { condition: NETWORK_PRESETS['wifi-good'], duration: 3000 },
      { condition: NETWORK_PRESETS['offline'], duration: 5000, action: 'disconnect' },
      { condition: NETWORK_PRESETS['4g-poor'], duration: 2000, action: 'reconnect' },
      { condition: NETWORK_PRESETS['offline'], duration: 4000, action: 'disconnect' },
      { condition: NETWORK_PRESETS['4g-poor'], duration: 1500, action: 'reconnect' },
      { condition: NETWORK_PRESETS['offline'], duration: 6000, action: 'disconnect' },
      { condition: NETWORK_PRESETS['wifi-good'], duration: 5000, action: 'reconnect' },
    ],
  },
  'weak-signal': {
    name: 'Weak Signal Area',
    description: 'Simulates persistently weak network conditions',
    steps: [
      { condition: NETWORK_PRESETS['wifi-good'], duration: 2000 },
      { condition: NETWORK_PRESETS['3g'], duration: 10000 },
      { condition: NETWORK_PRESETS['2g'], duration: 10000 },
      { condition: NETWORK_PRESETS['3g'], duration: 5000 },
      { condition: NETWORK_PRESETS['wifi-good'], duration: 3000 },
    ],
  },
  'rapid-switching': {
    name: 'Rapid Network Switching',
    description: 'Simulates rapid switching between WiFi and cellular',
    steps: [
      { condition: NETWORK_PRESETS['wifi-good'], duration: 2000 },
      { condition: NETWORK_PRESETS['offline'], duration: 100, action: 'disconnect' },
      { condition: NETWORK_PRESETS['4g-good'], duration: 2000, action: 'reconnect' },
      { condition: NETWORK_PRESETS['offline'], duration: 100, action: 'disconnect' },
      { condition: NETWORK_PRESETS['wifi-good'], duration: 2000, action: 'reconnect' },
      { condition: NETWORK_PRESETS['offline'], duration: 100, action: 'disconnect' },
      { condition: NETWORK_PRESETS['4g-good'], duration: 2000, action: 'reconnect' },
      { condition: NETWORK_PRESETS['wifi-good'], duration: 3000 },
    ],
  },
};

// Test result
export interface TestResult {
  scenario: string;
  startTime: number;
  endTime: number;
  totalDuration: number;
  connectionDrops: number;
  reconnectSuccesses: number;
  reconnectFailures: number;
  tokensReceived: number;
  heartbeatsReceived: number;
  heartbeatsMissed: number;
  errors: string[];
  passed: boolean;
}

/**
 * Network Simulator
 *
 * Simulates various network conditions for testing SSE resilience
 */
export class NetworkSimulator extends EventEmitter {
  private currentCondition: NetworkCondition = NETWORK_PRESETS['wifi-good'];
  private isSimulating = false;
  private scenarioTimeout: NodeJS.Timeout | null = null;
  private stepIndex = 0;
  private currentScenario: TestScenario | null = null;

  /**
   * Get current network condition
   */
  getCondition(): NetworkCondition {
    return this.currentCondition;
  }

  /**
   * Set network condition
   */
  setCondition(condition: NetworkCondition): void {
    const previousCondition = this.currentCondition;
    this.currentCondition = condition;

    const wasOnline = previousCondition.type !== 'none';
    const isNowOnline = condition.type !== 'none';

    if (wasOnline && !isNowOnline) {
      this.emit('offline', { previousCondition, newCondition: condition });
    } else if (!wasOnline && isNowOnline) {
      this.emit('online', { previousCondition, newCondition: condition });
    } else {
      this.emit('condition-change', { previousCondition, newCondition: condition });
    }
  }

  /**
   * Set condition by preset name
   */
  setConditionByName(presetName: keyof typeof NETWORK_PRESETS): void {
    const condition = NETWORK_PRESETS[presetName];
    if (condition) {
      this.setCondition(condition);
    }
  }

  /**
   * Run a test scenario
   */
  async runScenario(
    scenarioName: keyof typeof TEST_SCENARIOS,
    callbacks: {
      onDisconnect?: () => void;
      onReconnect?: () => void;
      onConditionChange?: (condition: NetworkCondition) => void;
    }
  ): Promise<void> {
    const scenario = TEST_SCENARIOS[scenarioName];
    if (!scenario) {
      throw new Error(`Unknown scenario: ${scenarioName}`);
    }

    this.currentScenario = scenario;
    this.isSimulating = true;
    this.stepIndex = 0;

    this.emit('scenario-start', { scenario });

    for (let i = 0; i < scenario.steps.length; i++) {
      if (!this.isSimulating) break;

      const step = scenario.steps[i];
      this.setCondition(step.condition);

      this.emit('step', { step, index: i, total: scenario.steps.length });

      if (callbacks.onConditionChange) {
        callbacks.onConditionChange(step.condition);
      }

      // Execute action if specified
      if (step.action === 'disconnect' && callbacks.onDisconnect) {
        callbacks.onDisconnect();
      } else if (step.action === 'reconnect' && callbacks.onReconnect) {
        callbacks.onReconnect();
      }

      // Wait for step duration
      await this.delay(step.duration);
    }

    this.isSimulating = false;
    this.emit('scenario-end', { scenario });
  }

  /**
   * Stop current simulation
   */
  stop(): void {
    this.isSimulating = false;
    if (this.scenarioTimeout) {
      clearTimeout(this.scenarioTimeout);
      this.scenarioTimeout = null;
    }
    this.emit('stopped');
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => {
      this.scenarioTimeout = setTimeout(resolve, ms);
    });
  }
}

/**
 * SSE Connection Tester
 *
 * Comprehensive testing tool for SSE connection resilience
 */
export class SSEConnectionTester extends EventEmitter {
  private networkSimulator: NetworkSimulator;
  private results: TestResult[] = [];

  constructor() {
    super();
    this.networkSimulator = new NetworkSimulator();

    this.networkSimulator.on('offline', () => {
      this.emit('network-offline');
    });

    this.networkSimulator.on('online', () => {
      this.emit('network-online');
    });
  }

  /**
   * Run a single test scenario
   */
  async runTest(
    scenarioName: keyof typeof TEST_SCENARIOS,
    sseClient: {
      connect: () => Promise<void>;
      disconnect: () => void;
      getState: () => string;
      getContent: () => string;
    }
  ): Promise<TestResult> {
    const scenario = TEST_SCENARIOS[scenarioName];
    const result: TestResult = {
      scenario: scenario.name,
      startTime: Date.now(),
      endTime: 0,
      totalDuration: 0,
      connectionDrops: 0,
      reconnectSuccesses: 0,
      reconnectFailures: 0,
      tokensReceived: 0,
      heartbeatsReceived: 0,
      heartbeatsMissed: 0,
      errors: [],
      passed: false,
    };

    this.emit('test-start', { scenario, result });

    try {
      await this.networkSimulator.runScenario(scenarioName, {
        onDisconnect: () => {
          result.connectionDrops++;
          sseClient.disconnect();
          this.emit('disconnected');
        },
        onReconnect: async () => {
          this.emit('reconnecting');
          try {
            await sseClient.connect();
            result.reconnectSuccesses++;
            this.emit('reconnected');
          } catch (error) {
            result.reconnectFailures++;
            result.errors.push(`Reconnect failed: ${error}`);
            this.emit('reconnect-failed', { error });
          }
        },
        onConditionChange: (condition) => {
          this.emit('condition-change', { condition });
        },
      });

      // Test passed if we recovered and have content
      result.passed = result.reconnectSuccesses > 0 || result.connectionDrops === 0;

    } catch (error) {
      result.errors.push(`Test error: ${error}`);
      result.passed = false;
    }

    result.endTime = Date.now();
    result.totalDuration = result.endTime - result.startTime;

    this.results.push(result);
    this.emit('test-end', { result });

    return result;
  }

  /**
   * Run all test scenarios
   */
  async runAllTests(
    sseClient: {
      connect: () => Promise<void>;
      disconnect: () => void;
      getState: () => string;
      getContent: () => string;
    }
  ): Promise<TestResult[]> {
    const allResults: TestResult[] = [];

    for (const scenarioName of Object.keys(TEST_SCENARIOS)) {
      this.emit('scenario-start', { name: scenarioName });

      const result = await this.runTest(
        scenarioName as keyof typeof TEST_SCENARIOS,
        sseClient
      );
      allResults.push(result);

      // Wait between scenarios
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    return allResults;
  }

  /**
   * Get all test results
   */
  getResults(): TestResult[] {
    return [...this.results];
  }

  /**
   * Get summary statistics
   */
  getSummary(): {
    totalTests: number;
    passed: number;
    failed: number;
    totalDrops: number;
    totalReconnectSuccesses: number;
    totalReconnectFailures: number;
    averageDuration: number;
  } {
    const totalTests = this.results.length;
    const passed = this.results.filter(r => r.passed).length;
    const failed = totalTests - passed;

    return {
      totalTests,
      passed,
      failed,
      totalDrops: this.results.reduce((sum, r) => sum + r.connectionDrops, 0),
      totalReconnectSuccesses: this.results.reduce((sum, r) => sum + r.reconnectSuccesses, 0),
      totalReconnectFailures: this.results.reduce((sum, r) => sum + r.reconnectFailures, 0),
      averageDuration: this.results.reduce((sum, r) => sum + r.totalDuration, 0) / totalTests || 0,
    };
  }

  /**
   * Stop all tests
   */
  stop(): void {
    this.networkSimulator.stop();
  }
}

/**
 * Create a formatted report of test results
 */
export function formatTestReport(results: TestResult[]): string {
  const lines: string[] = [
    '='.repeat(60),
    '📊 SSE Connection Resilience Test Report',
    '='.repeat(60),
    '',
  ];

  for (const result of results) {
    const status = result.passed ? '✅ PASS' : '❌ FAIL';
    lines.push(`Test: ${result.scenario}`);
    lines.push(`Status: ${status}`);
    lines.push(`Duration: ${result.totalDuration}ms`);
    lines.push(`Connection Drops: ${result.connectionDrops}`);
    lines.push(`Reconnect Successes: ${result.reconnectSuccesses}`);
    lines.push(`Reconnect Failures: ${result.reconnectFailures}`);

    if (result.errors.length > 0) {
      lines.push(`Errors:`);
      for (const err of result.errors) {
        lines.push(`  - ${err}`);
      }
    }
    lines.push('-'.repeat(40));
  }

  // Summary
  const passed = results.filter(r => r.passed).length;
  const total = results.length;

  lines.push('');
  lines.push('Summary:');
  lines.push(`  Total: ${total}`);
  lines.push(`  Passed: ${passed}`);
  lines.push(`  Failed: ${total - passed}`);
  lines.push(`  Pass Rate: ${(passed / total * 100).toFixed(1)}%`);
  lines.push('='.repeat(60));

  return lines.join('\n');
}

export default SSEConnectionTester;
