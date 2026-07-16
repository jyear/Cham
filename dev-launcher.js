// Sets NODE_ENV=development then spawns electron
// Extra args after '--' are forwarded: node dev-launcher.js -- --dev-plugin example/foo
process.env.NODE_ENV = 'development';
const { spawn } = require('child_process');
const electron = require('electron');

const extraArgs = process.argv.slice(2); // everything after 'node dev-launcher.js'
const child = spawn(electron, ['.', ...extraArgs], { stdio: 'inherit', shell: true });
child.on('exit', (code) => process.exit(code));
