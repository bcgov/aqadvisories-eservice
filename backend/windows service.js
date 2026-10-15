var Service = require('node-windows').Service;

// Create a new service object
var svc = new Service({
  name: process.argv[2] || 'notifyBC',
  description: 'notifyBC Windows Service',
  script: 'server\\server.js',
  nodeOptions: [
    '--inspect=0'
  ],
  env: [{
    name: "NODE_ENV",
    value: "production"
  }]
});

// Listen for the "install" event, which indicates the
// process is available as a service.
svc.on('install', function () {
  svc.start();
});

svc.install();
