import "./src/wsServer"           // starts WS server
import "./src/publishListener"     // starts Redis SUBSCRIBE
import { readEngineEmits } from "./src/engineConsumer"

readEngineEmits().catch(() => process.exit(1))
