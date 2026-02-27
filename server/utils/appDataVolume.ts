import { accessSync, existsSync } from 'fs';
import path from 'path';

const CONFIG_PATH = process.env.CONFIG_DIRECTORY
  ? process.env.CONFIG_DIRECTORY
  : path.join(__dirname, '../../config');

const DOCKER_PATH = `${CONFIG_PATH}/DOCKER`;

export const appDataStatus = (): boolean => {
  return !existsSync(DOCKER_PATH);
};

export const appDataPath = (): string => {
  return CONFIG_PATH;
};

export const appDataPermissions = (): boolean => {
  try {
    accessSync(CONFIG_PATH);
    return true;
  } catch {
    return false;
  }
};
