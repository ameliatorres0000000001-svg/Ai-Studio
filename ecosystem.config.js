// PM2 process file. Run once with: pm2 start ecosystem.config.js && pm2 save
module.exports = {
  apps: [
    {
      name: "codingstudio",
      script: "node_modules/next/dist/bin/next",
      args: "start -p 3000 -H 127.0.0.1",
      instances: 1,
      exec_mode: "fork",
      max_memory_restart: "1G",
      env: {
        NODE_ENV: "production",
        PORT: "3000",
        HOSTNAME: "127.0.0.1",
      },
    },
  ],
};
