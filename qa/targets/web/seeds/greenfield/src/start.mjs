import { createServer } from "./server.mjs";

createServer().listen(process.env.PORT ?? 3000, () => console.log("greenfield-web up"));
