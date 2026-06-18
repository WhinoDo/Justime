const { spawn } = require('child_process');

console.log('\n================================================');
console.log('📱 Starting Expo Metro Bundler...');
console.log('   API URL is configured via EXPO_PUBLIC_API_BASE_URL');
console.log('   Default: http://127.0.0.1:8080');
console.log('================================================\n');

const childEnv = Object.assign({}, process.env);

delete childEnv.all_proxy;
delete childEnv.ALL_PROXY;

childEnv.no_proxy = 'localhost,127.0.0.1,::1';
childEnv.NO_PROXY = 'localhost,127.0.0.1,::1';

if (!childEnv.EXPO_PUBLIC_API_BASE_URL) {
  childEnv.EXPO_PUBLIC_API_BASE_URL = 'http://127.0.0.1:8080';
}

const useTunnel = process.argv.includes('--tunnel');
const expoArgs = useTunnel 
  ? ['expo', 'start', '--tunnel']
  : ['expo', 'start'];

const expoProcess = spawn('npx', expoArgs, {
  env: childEnv,
  stdio: 'inherit',
  shell: true,
});

const cleanup = () => {
  console.log('\n🛑 Shutting down...');
  if (expoProcess && !expoProcess.killed) {
    expoProcess.kill();
  }
  process.exit();
};

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
