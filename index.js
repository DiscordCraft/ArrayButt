const DiscordClient = require('eris');
const needle = require('needle');
const {logs, LogLevel} = require('./logs.js');

const usedLogLevel = LogLevel[process.env.BOT_LOG_LEVEL] || LogLevel.INFO;
logs.setLevel(usedLogLevel);
logs.info(`Log level ${usedLogLevel.prefix}.`);

logs.info('Loading configuration...');
const conf = {};
for (const key of ['url', 'token']) {
  conf[key] = process.env[`BOT_${key.toUpperCase()}`];
  if (!conf[key]) throw new Error(`Expected env var BOT_${key.toUpperCase}!`);
}

logs.info('Creating Discord client...');
const client = new DiscordClient(conf.token);
let authTime;

client.on('ready', () => {
  logs.info(`Authenticated successfully in ${Date.now() - authTime} ms.`);
});

client.on('messageCreate', msg => {
  
});

logs.info('Authenticating...');
authTime = Date.now();
client.connect();