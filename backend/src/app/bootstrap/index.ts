import { Express } from "express";
import { dbConnection } from "./mongoose/dbConnection";
import { ExpressServer } from "./express/expressServer";

export async function bootStrapApp(app: Express, PORT: number) {
  await dbConnection();
  ExpressServer(app, PORT);
}
