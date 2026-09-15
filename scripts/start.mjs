process.env.BODY_SIZE_LIMIT ??= '21M';
if (process.env.APP_ORIGIN) process.env.ORIGIN ??= process.env.APP_ORIGIN;
await import('../build/index.js');
