import { createServer } from "node:http";

const values = new Map();

function encode(value, base64) {
  return base64
    ? Buffer.from(String(value), "utf8").toString("base64")
    : value;
}

function execute(command) {
  const [name, key] = command;
  switch (String(name ?? "").toLowerCase()) {
    case "ping":
      return "PONG";
    case "incr": {
      const next = Number(values.get(key) ?? 0) + 1;
      values.set(key, next);
      return next;
    }
    case "pexpire":
      return 1;
    case "pttl":
      return 60_000;
    default:
      return "OK";
  }
}

const server = createServer(async (request, response) => {
  let body = "";
  for await (const chunk of request) body += chunk;
  let command = [];
  let parsed;
  try {
    parsed = JSON.parse(body || "[]");
    command = Array.isArray(parsed) && Array.isArray(parsed[0]) ? parsed[0] : parsed;
  } catch {
    response.writeHead(400, { "content-type": "application/json" });
    response.end(JSON.stringify({ error: "invalid command" }));
    return;
  }

  const base64 = request.headers["upstash-encoding"] === "base64";
  const isPipeline = Array.isArray(parsed) && Array.isArray(parsed[0]);
  const commands = isPipeline ? parsed : [parsed];
  const result = isPipeline
    ? commands.map((item) => ({ result: encode(execute(item), base64) }))
    : { result: encode(execute(command, base64), base64) };
  response.writeHead(200, { "content-type": "application/json" });
  response.end(JSON.stringify(result));
});

server.listen(Number(process.env.REDIS_STUB_PORT ?? 8080), "0.0.0.0");
