import { StreamChat } from "stream-chat";
import { config } from "./index";

const ApiKey = config.getstreamApiKey;
const ApiSecret = config.getstreamApiSecret;

if (!ApiKey || !ApiSecret) {
  console.error("GetStream API key or secret is missing");
  process.exit(1);
}
const connectStreamClient = () => StreamChat.getInstance(ApiKey, ApiSecret);

export { connectStreamClient };
