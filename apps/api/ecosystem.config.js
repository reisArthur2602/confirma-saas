export default {
  apps: [
    {
      name: 'confirma-api',
      cwd: import.meta.dirname,
      script: 'dist/server.js',
      node_args: '--env-file=.env',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
};
