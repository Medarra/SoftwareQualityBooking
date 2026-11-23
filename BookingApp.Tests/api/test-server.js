import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as sleep } from 'node:timers/promises';

const serverFile = fileURLToPath(
    new URL('../../server.js', import.meta.url)
);

// Find an available port for the test server.
async function getAvailablePort() {
    const socket = createServer();

    await new Promise((resolve, reject) => {
        socket.once('error', reject);
        socket.listen(0, '127.0.0.1', resolve);
    });

    const port = socket.address().port;
    await new Promise(resolve => socket.close(resolve));

    return port;
}

export async function startTestServer() {
    // Arrange isolated server data.
    const directory = await mkdtemp(join(tmpdir(), 'booking-api-'));
    const port = await getAvailablePort();
    const url = `http://127.0.0.1:${port}`;

    // Start the real booking application.
    const child = spawn(process.execPath, [serverFile], {
        cwd: dirname(serverFile),
        env: {
            ...process.env,
            PORT: String(port),
            BOOKING_DATA_FILE: join(directory, 'booking.json')
        },
        stdio: ['ignore', 'ignore', 'pipe']
    });

    let errors = '';
    let startupError = null;

    child.stderr.on('data', data => {
        errors += data.toString();
    });

    child.on('error', error => {
        startupError = error;
    });

    // Shut down the server and remove temporary data.
    async function stop() {
        if (child.exitCode === null && child.signalCode === null) {
            const exited = new Promise(resolve => {
                child.once('exit', resolve);
            });

            child.kill();
            await Promise.race([exited, sleep(2000)]);
        }

        await rm(directory, { recursive: true, force: true });
    }

    // Wait for the server to become ready.
    const deadline = Date.now() + 10000;

    while (Date.now() < deadline) {
        if (startupError || child.exitCode !== null) break;

        try {
            const response = await fetch(`${url}/api/bootstrap`, {
                signal: AbortSignal.timeout(500)
            });

            if (response.ok) {
                return { url, stop };
            }
        } catch {
            // The server may still be starting.
        }

        await sleep(100);
    }

    await stop();
    throw new Error(`Test server failed to start: ${startupError || errors}`);
}
