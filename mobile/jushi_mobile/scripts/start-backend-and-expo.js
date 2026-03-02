const ngrok = require('ngrok');
const fs = require('fs');
const path = require('path');
const { spawn, execSync } = require('child_process');
const qrcode = require('qrcode-terminal');

(async () => {
    // Kill any orphaned ngrok or node processes to prevent port conflicts
    try { execSync('killall -9 ngrok 2>/dev/null'); } catch (e) { }
    console.log('🚇 Starting ngrok for backend API (port 8080)...');
    try {
        // Start ngrok tunnel for backend
        const backendUrl = await ngrok.connect(8080);
        console.log(`✅ Backend is now exposed at: ${backendUrl}`);

        // Update .env file
        const envPath = path.join(__dirname, '..', '.env');
        let envContent = '';
        if (fs.existsSync(envPath)) {
            envContent = fs.readFileSync(envPath, 'utf8');
        }

        if (envContent.includes('EXPO_PUBLIC_API_BASE_URL')) {
            envContent = envContent.replace(/EXPO_PUBLIC_API_BASE_URL=.*/g, `EXPO_PUBLIC_API_BASE_URL=${backendUrl}`);
        } else {
            envContent += `\nEXPO_PUBLIC_API_BASE_URL=${backendUrl}\n`;
        }

        fs.writeFileSync(envPath, envContent.trim() + '\n');
        console.log('📝 Updated .env with new stable backend URL.');

        console.log('\n================================================');
        console.log('📱 Starting Expo Metro Bundler on Local Network...');
        console.log('   (Your phone will connect to this Local IP to download the app bundle, ');
        console.log('    and the app itself will use the public Localtunnel URL for the Backend API.)');
        console.log('================================================\n');

        // Strip ONLY SOCKS proxy vars (all_proxy) from env to prevent Node 20 undici fetch crash in Expo cli.
        // We MUST keep http_proxy and https_proxy so Expo can still reach the internet since you're using a proxy!
        const childEnv = Object.assign({}, process.env);
        delete childEnv.all_proxy;
        delete childEnv.ALL_PROXY;

        // Explicitly set no_proxy just to be completely safe for any nested child processes
        childEnv.no_proxy = 'localhost,127.0.0.1,::1,192.168.0.102';
        childEnv.NO_PROXY = 'localhost,127.0.0.1,::1,192.168.0.102';

        // Start expo normally, without the flaky ngrok tunnel
        // NOTE: Actually, to support BOTH local iOS debugging and external physical device access, 
        // we use the --tunnel flag. This creates a secure, public ngrok url for the Metro bundler.
        const expoProcess = spawn('npx', ['expo', 'start', '--tunnel'], {
            env: childEnv,
            stdio: 'inherit',
            shell: true,
        });

        // Cleanup on exit
        const cleanup = async () => {
            console.log('\n🛑 Closing tunnels and shutting down...');
            try { await ngrok.disconnect(); } catch (e) { }
            if (expoProcess && !expoProcess.killed) {
                expoProcess.kill();
            }
            process.exit();
        };

        process.on('SIGINT', cleanup);
        process.on('SIGTERM', cleanup);

    } catch (err) {
        console.error('❌ Failed to start tunnels:', err);
    }
})();
