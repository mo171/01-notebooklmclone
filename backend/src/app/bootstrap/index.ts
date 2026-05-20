

import { Express } from 'express';
import { ExpressServer } from './express/expressServer';

export function bootStrapApp(app: Express, PORT: number) {

        ExpressServer(app, PORT);
}