import * as dotenv from 'dotenv';
dotenv.config();

export interface EnvironmentConfig {
  SERVER_PORT: number;
  DB_URL: string;
  EMAIL_HOST: string;
  EMAIL_USER: string;
  EMAIL_PASSWORD: string;
  EMAIL_PORT: number;
  EMAIL_FROM: string;
}

export const environmentConfig: EnvironmentConfig = {
  SERVER_PORT: process.env.serverPort ? parseInt(process.env.serverPort, 10) : 3000,
  DB_URL: process.env.DbUrl || 'mongodb://localhost:27017/mydatabase',
  EMAIL_HOST: process.env.emailHost || 'email@example.com',
  EMAIL_USER: process.env.emailUser || 'email@example.com',
  EMAIL_PASSWORD: process.env.emailPassword || 'emailPassword',
  EMAIL_PORT: process.env.emailPort ? parseInt(process.env.emailPort, 10) : 587,
  EMAIL_FROM: process.env.emailFrom || 'noreply@example.com',
};
