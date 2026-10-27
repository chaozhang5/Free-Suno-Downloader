export function backendEnv(source = process.env) {
  const env = { ...source };
  const hasProxy = ['HTTPS_PROXY', 'HTTP_PROXY', 'ALL_PROXY', 'https_proxy', 'http_proxy', 'all_proxy']
    .some((name) => Boolean(env[name]));
  if (hasProxy && env.NODE_USE_ENV_PROXY === undefined && Number(process.versions.node.split('.')[0]) >= 24) {
    env.NODE_USE_ENV_PROXY = '1';
  }
  return env;
}
