import packageJson from '../package.json';

export const APP_VERSION = packageJson.version;
export const BUILD_ID = import.meta.env.VITE_BUILD_ID || 'local';
export const BUILD_LABEL = `BUILD ${APP_VERSION} · ${BUILD_ID}`;
