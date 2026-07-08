// Sets NODE_ENV=development then spawns electron
process.env.NODE_ENV = 'development';
const { spawn } = require('child_process');
const electron = require('electron');
const child = spawn(electron, ['.'], { stdio: 'inherit', shell: true });
child.on('exit', (code) => process.exit(code));
