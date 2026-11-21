module.exports = {
  apps: [
    {
      name: 'mpharm-server',
      script: 'node_modules/next/dist/bin/next',
      args: 'start -p 5888',
      cwd: __dirname,
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        PORT: 5888,
      },
    },
  ],
}
